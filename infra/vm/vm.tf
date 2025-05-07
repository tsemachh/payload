provider "google" {
  project = var.project
  region  = var.region
}

# Network
resource "google_compute_network" "payload_network" {
  name                    = "${var.prefix}-network"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "payload_subnet" {
  name          = "${var.prefix}-subnet"
  ip_cidr_range = "10.0.0.0/24"
  region        = var.region
  network       = google_compute_network.payload_network.id
}

# Firewall Rules
resource "google_compute_firewall" "allow_ssh_http_s" {
  name    = "allow-ssh-http-s"
  network = google_compute_network.payload_network.id

  allow {
    protocol = "tcp"
    ports    = ["22", "80", "443", "3000"]
  }

  source_ranges = ["0.0.0.0/0"]  
}

# Allow load balancer to access the VM on port 3000
# resource "google_compute_firewall" "allow_load_balancer" {
#   name    = "allow-load-balancer-to-vm"
#   network = google_compute_network.payload_network.id

#   allow {
#     protocol = "tcp"
#     ports    = ["3000"]
#   }

#   source_ranges = [google_compute_global_address.load_balancer_ip.address]  # Allow only LB IP
# }

# Deny all other incoming traffic 
resource "google_compute_firewall" "deny_all_other" {
  name    = "deny-all-other"
  network = google_compute_network.payload_network.id

  deny {
    protocol = "all"
  }

  priority      = 65534
  source_ranges = ["0.0.0.0/0"]  # Blocks all traffic by default
}

resource "google_compute_firewall" "allow_outbound" {
  name    = "allow-outbound"
  network = google_compute_network.payload_network.id

  allow {
    protocol = "all"
  }

  direction = "EGRESS"
  destination_ranges = ["0.0.0.0/0"]
}

resource "google_compute_security_policy" "payload_security_policy" {
  name = "${var.prefix}-security-policy"

  # Rule 1: Allow traffic from the load balancer IP
  rule {
    action   = "allow"
    priority = 100
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = [google_compute_global_address.load_balancer_ip.address]  # Allow only LB IP
      }
    }
    description = "Allow traffic from the load balancer IP"
  }

 rule {
    action   = "allow"
    priority = 200
    match {
      expr {
        expression = <<-EOT
          request.headers['host'].contains('${var.domain_name}') 
        EOT
      }
    }
    description = "Allow traffic from LB IP with correct Host header"
  }
#   # Rule 2: Allow traffic from specific trusted IPs (optional)
#   rule {
#     action   = "allow"
#     priority = 200
#     match {
#       versioned_expr = "SRC_IPS_V1"
#       config {
#         src_ip_ranges = [""] 
#       }
#     }
#     description = "Allow traffic from trusted IPs"
#   }

  # Rule 3: Default deny rule (required by Google Cloud Armor)
  rule {
    action   = "deny(403)"
    priority = 2147483647  # Default rule priority
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]  # Matches all IPs
      }
    }
    description = "Default deny rule"
  }
}


# Load Balancer IP
resource "google_compute_global_address" "load_balancer_ip" {
  name   = "${var.prefix}-loadbalancer-ip"

   lifecycle {
     prevent_destroy = true
   }
}

# Service Account
resource "google_service_account" "payload_sa" {
  account_id   = "${var.prefix}-service-account"
  display_name = "${var.prefix} VM Service Account"
}

# VM Instance
resource "google_compute_instance" "payload_vm" {
  name         = "${var.prefix}-vm"
  machine_type = "e2-medium"
  zone         = var.zone

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-11"
    }
  }

  network_interface {
    network    = google_compute_network.payload_network.id
    subnetwork = google_compute_subnetwork.payload_subnet.id
  }

  service_account {
    email  = google_service_account.payload_sa.email
    scopes = ["cloud-platform"]
  }

  metadata_startup_script = <<-EOT
#!/bin/bash

# Set the timezone to Asia/Jerusalem
sudo timedatectl set-timezone Asia/Jerusalem

# Ensure the VM is up to date and install necessary dependencies
sudo apt-get update
sudo apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release

# Add Docker’s official GPG key
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Set up the Docker repository
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Enable and start Docker service
sudo systemctl enable docker
sudo systemctl start docker

# Configure Docker to use gcloud as a credential helper
gcloud auth configure-docker me-west1-docker.pkg.dev --quiet
# Create the ${var.prefix} directory
sudo mkdir -p ${var.prefix}

# Create docker-compose.yml in ${var.prefix}/
cat <<EOF | sudo tee ${var.prefix}/docker-compose.yml
version: '3'
services:
  ${var.prefix}-app:
    image: ${var.docker_image}:${var.docker_tag}
    environment:
      - DATABASE_URI=${var.database_uri}
      - PAYLOAD_SECRET=${var.payload_secret}
      - HOST=0.0.0.0
      - NEXT_PUBLIC_SERVER_URL=https://${var.domain_name}
      - GCS_BUCKET=${var.gcs_bucket}
      - GCS_PROJECT_ID=${var.project}
      - GCS_ENDPOINT=https://storage.googleapis.com
      - LOGTAIL_SOURCE_TOKEN=${var.logtail_source_token}
      - TZ=Asia/Jerusalem
    ports:
      - "${var.health_check_port}:${var.health_check_port}"
    restart: always
EOF

# Navigate to ${var.prefix}
cd ${var.prefix}

#backup logs
sudo mkdir -p /${var.prefix}/logs

# Save previous logs before restarting
sudo docker-compose logs --no-color --timestamps > "/${var.prefix}/logs/docker-compose-$(date +"%Y-%m-%d_%H-%M-%S").txt"

sudo docker-compose down || true

# Clean docker cache
sudo docker image rm ${var.docker_image}:${var.docker_tag} || true

# Pull latest
gcloud auth configure-docker me-west1-docker.pkg.dev --quiet
sudo docker-compose pull

# Run Docker Compose
gcloud auth configure-docker me-west1-docker.pkg.dev --quiet
sudo docker-compose up -d

#Setup cron job for updates

sudo mkdir -p /${var.prefix}/logs/cron

cat > /${var.prefix}/docker-image-updater.sh << EOF
#!/bin/bash

# Configure these variables
SLACK_WEBHOOK_URL="${var.slack_webhook_url}"
# Authenticate with GCR
sudo gcloud auth configure-docker me-west1-docker.pkg.dev --quiet

# Get current digests
REMOTE_DIGEST=$(sudo gcloud container images list-tags "${var.docker_image}" \
  --filter="tags=${var.docker_tag}" \
  --format='get(digest)' \
  --sort-by=~TIMESTAMP \
  --limit=1)

LOCAL_DIGEST=$(sudo docker image inspect "${var.docker_image}:${var.docker_tag}" --format '{{index .RepoDigests 0}}' 2>/dev/null | cut -d '@' -f 2)

# Check if update needed
if [ "$REMOTE_DIGEST" != "$LOCAL_DIGEST" ]; then
  echo "$(date +"%Y-%m-%d %H:%M:%S") - New image detected. Pulling..."
  sudo docker pull "${var.docker_image}:${var.docker_tag}"
  sudo docker-compose -f "/${var.prefix}/docker-compose.yml" down
  sudo docker-compose -f "/${var.prefix}/docker-compose.yml" up -d --force-recreate
  sudo docker image prune -a --force
  echo "$(date +"%Y-%m-%d %H:%M:%S") - New image updated."
  # Send Slack notification about the change
  curl -X POST -H 'Content-type: application/json' --data "{
    \"text\": \"New Docker image deployed!\n*Image:* ${var.docker_image}\n*Tag:* ${var.docker_tag}\n*Environment URL:* https://${var.domain_name}\"
  }" $SLACK_WEBHOOK_URL
else
  echo "No changes detected."
fi
EOF

chmod +x /${var.prefix}/docker-image-updater.sh

touch /${var.prefix}/logs/cron/docker-updater-log.txt
chmod 644 /${var.prefix}/logs/cron/docker-updater-log.txt

# Add the cron job to the root user's crontab
if ! crontab -l 2>/dev/null | grep -q "/${var.prefix}/docker-image-updater.sh"; then
  (crontab -l 2>/dev/null; echo "*/3 * * * * /${var.prefix}/docker-image-updater.sh >> /${var.prefix}/logs/cron/docker-updater-log-$(date +'%Y-%m-%d-%H-%M-%S').txt 2>&1") | crontab -
fi


EOT

  tags = ["https-server", "ssh-server"]
}

# Instance Group (for the load balancer backend)
resource "google_compute_instance_group" "payload_instance_group" {
  name        = "${var.prefix}-instance-group"
  description = "Instance group for the ${var.prefix} VM"
  zone        = var.zone

  instances = [google_compute_instance.payload_vm.self_link]

  named_port {
    name = "http"
    port = var.health_check_port
  }
}

# IAM Binding for Artifact Registry Access
resource "google_project_iam_member" "artifact_registry_access" {
  project = var.project
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.payload_sa.email}"
}

# Health Check
# resource "google_compute_health_check" "payload_health_check" {
#   name               = "payload-http-health-check"
#   check_interval_sec = 60
#   timeout_sec        = 300
#   healthy_threshold  = 2
#   unhealthy_threshold = 2

#   http_health_check {
#     port        = 3000
#     request_path = "/"
#   }
# }

resource "google_compute_health_check" "payload_health_tcp_check" {
  name               = "${var.prefix}-tcp-health-check"
  check_interval_sec = 300
  timeout_sec        = 300
  healthy_threshold  = 2
  unhealthy_threshold = 2

  tcp_health_check {
    port = var.health_check_port
  }
}

# Backend Service
resource "google_compute_backend_service" "payload_backend" {
  name                  = "${var.prefix}-backend-service"
  health_checks         = [google_compute_health_check.payload_health_tcp_check.self_link]
  load_balancing_scheme = "EXTERNAL"
  security_policy       = google_compute_security_policy.payload_security_policy.self_link

  backend {
    group = google_compute_instance_group.payload_instance_group.self_link

  }

  protocol = "HTTP"        
  port_name = "http"  

  session_affinity = "NONE"
  timeout_sec      = 300

}

# URL Map
resource "google_compute_url_map" "payload_url_map" {
  name            = "${var.prefix}-url-map"
  default_service = google_compute_backend_service.payload_backend.self_link
}

# SSL Certificate
resource "google_compute_managed_ssl_certificate" "payload_ssl" {
  name = "${var.prefix}-ssl-cert"
  managed {
    domains = [var.domain_name]  
  }
}

# HTTPS Proxy
resource "google_compute_target_https_proxy" "payload_https_proxy" {
  name             = "${var.prefix}-https-proxy"
  url_map          = google_compute_url_map.payload_url_map.self_link
  ssl_certificates = [google_compute_managed_ssl_certificate.payload_ssl.self_link]
}

# Forwarding Rule
resource "google_compute_global_forwarding_rule" "payload_https_forwarding_rule" {
  name                  = "${var.prefix}-https-forwarding-rule"
  target                = google_compute_target_https_proxy.payload_https_proxy.self_link
  port_range            = "443"
  load_balancing_scheme = "EXTERNAL"
  ip_address            = google_compute_global_address.load_balancer_ip.address
}

# Create the Cloud Router
resource "google_compute_router" "payload_router" {
  name    = "${var.prefix}-router"
  region  = var.region
  network = google_compute_network.payload_network.id
}

# Create the Cloud NAT configuration
resource "google_compute_router_nat" "payload_nat" {
  name                               = "${var.prefix}-nat"
  router                            = google_compute_router.payload_router.name
  region                            = var.region
  nat_ip_allocate_option            = "AUTO_ONLY"  # Automatically allocate IPs for NAT
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  # Enable endpoint independent mapping (optional)
  enable_endpoint_independent_mapping = true
}


# Output
output "load_balancer_ip" {
  value       = google_compute_global_address.load_balancer_ip.address
  description = "The IP address to configure in DNS for the domain"
}
