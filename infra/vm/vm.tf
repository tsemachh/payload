provider "google" {
  project = "emda-dev" 
  region  = "me-west1"
}

# Network
resource "google_compute_network" "payload_network" {
  name                    = "payload-network"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "payload_subnet" {
  name          = "payload-subnet"
  ip_cidr_range = "10.0.0.0/24"
  region        = "me-west1"
  network       = google_compute_network.payload_network.id
}

# Firewall Rules
resource "google_compute_firewall" "allow_ssh_http_s" {
  name    = "allow-ssh-http-s"
  network = google_compute_network.payload_network.id

  allow {
    protocol = "tcp"
    ports    = ["22","80", "443","3000"]
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
  name = "payload-security-policy"

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
          request.headers['host'].contains('emda-dev.shefing.com') 
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
  name   = "payload-loadbalancer-ip"

  lifecycle {
    prevent_destroy = true
  }
}

# Service Account
resource "google_service_account" "payload_sa" {
  account_id   = "payload-service-account"
  display_name = "Payload VM Service Account"
}

# VM Instance
resource "google_compute_instance" "payload_vm" {
  name         = "payload-vm"
  machine_type = "e2-medium"
  zone         = "me-west1-b"

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
# Create the payload directory
sudo mkdir -p payload

# Create docker-compose.yml in payload/
cat <<EOF | sudo tee payload/docker-compose.yml 
version: '3'
services:
  payload-app:
    image: me-west1-docker.pkg.dev/emda-dev/emda-gcr/payload-image:latest
    environment:
      - DATABASE_URI=mongodb+srv://channahk:eadDVXob0UnZ2DZE@cluster0.einyx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
      - PAYLOAD_SECRET=9e9da2a4427c56cc0a45e076
    ports:
      - "3000:3000"
    restart: always 
EOF

# Navigate to payload 
cd payload

#backup logs
sudo mkdir -p /payload/logs

# Save previous logs before restarting
sudo docker-compose logs --no-color --timestamps > "/payload/logs/docker-compose-$(date +"%Y-%m-%d_%H-%M-%S").txt"

sudo docker-compose down || true

# Clean docker cache
sudo docker image rm me-west1-docker.pkg.dev/emda-dev/emda-gcr/payload-image:latest || true

# Pull latest
gcloud auth configure-docker me-west1-docker.pkg.dev --quiet
sudo docker-compose pull

# Run Docker Compose
gcloud auth configure-docker me-west1-docker.pkg.dev --quiet
sudo docker-compose up -d

#Setup cron job for updates

sudo mkdir -p /payload/logs/cron

cat > /payload/docker-image-updater.sh << 'EOF'
#!/bin/bash

# Configure these variables
IMAGE="me-west1-docker.pkg.dev/emda-dev/emda-gcr/payload-image"
TAG="latest"
COMPOSE_FILE="/payload/docker-compose.yml"

# Authenticate with GCR
sudo gcloud auth configure-docker me-west1-docker.pkg.dev --quiet

# Get current digests
REMOTE_DIGEST=$(sudo gcloud container images list-tags "${IMAGE}" \
  --filter="tags=${TAG}" \
  --format='get(digest)' \
  --sort-by=~TIMESTAMP \
  --limit=1)

LOCAL_DIGEST=$(sudo docker image inspect "${IMAGE}:${TAG}" --format '{{index .RepoDigests 0}}' 2>/dev/null | cut -d '@' -f 2)

# Check if update needed
if [ "$REMOTE_DIGEST" != "$LOCAL_DIGEST" ]; then
  echo "$(date +"%Y-%m-%d %H:%M:%S") - New image detected. Pulling..."
  sudo docker pull "${IMAGE}:${TAG}"
  sudo docker-compose -f "${COMPOSE_FILE}" up -d --force-recreate
  echo "$(date +"%Y-%m-%d %H:%M:%S") - New image updated."
else
  echo "No changes detected."
fi
EOF

chmod +x /payload/docker-image-updater.sh

touch /payload/logs/cron/docker-updater-log.txt
chmod 644 /payload/logs/cron/docker-updater-log.txt

# Add the cron job to the root user's crontab
if ! crontab -l 2>/dev/null | grep -q "/payload/docker-image-updater.sh"; then
  (crontab -l 2>/dev/null; echo "*/3 * * * * /payload/docker-image-updater.sh >> /payload/logs/cron/docker-updater-log-$(date +'%Y-%m-%d-%H-%M-%S').txt 2>&1") | crontab -
fi


EOT

  tags = ["https-server", "ssh-server"]
}

# Instance Group (for the load balancer backend)
resource "google_compute_instance_group" "payload_instance_group" {
  name        = "payload-instance-group"
  description = "Instance group for the Payload VM"
  zone        = "me-west1-b"

  instances = [google_compute_instance.payload_vm.self_link]

  named_port {
    name = "http"
    port = 3000
  }
}

# IAM Binding for Artifact Registry Access
resource "google_project_iam_member" "artifact_registry_access" {
  project = "emda-dev"
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.payload_sa.email}"
}

# Health Check
# resource "google_compute_health_check" "payload_health_check" {
#   name               = "payload-http-health-check"
#   check_interval_sec = 60
#   timeout_sec        = 30
#   healthy_threshold  = 2
#   unhealthy_threshold = 2

#   http_health_check {
#     port        = 3000
#     request_path = "/"
#   }
# }

resource "google_compute_health_check" "payload_health_tcp_check" {
  name               = "payload-tcp-health-check"
  check_interval_sec = 60
  timeout_sec        = 30
  healthy_threshold  = 2
  unhealthy_threshold = 2

  tcp_health_check {
    port = 3000  
  }
}

# Backend Service
resource "google_compute_backend_service" "payload_backend" {
  name                  = "payload-backend-service"
  health_checks         = [google_compute_health_check.payload_health_tcp_check.self_link]
  load_balancing_scheme = "EXTERNAL"
  security_policy       = google_compute_security_policy.payload_security_policy.self_link

  backend {
    group = google_compute_instance_group.payload_instance_group.self_link
    
  }
  
  protocol = "HTTP"        
  port_name = "http"  
      
  session_affinity = "NONE"
  timeout_sec      = 30
  
}

# URL Map
resource "google_compute_url_map" "payload_url_map" {
  name            = "payload-url-map"
  default_service = google_compute_backend_service.payload_backend.self_link
}

# SSL Certificate
resource "google_compute_managed_ssl_certificate" "payload_ssl" {
  name = "payload-ssl-cert"
  managed {
    domains = ["emda-dev.shefing.com"]  
  }
}

# HTTPS Proxy
resource "google_compute_target_https_proxy" "payload_https_proxy" {
  name             = "payload-https-proxy"
  url_map          = google_compute_url_map.payload_url_map.self_link
  ssl_certificates = [google_compute_managed_ssl_certificate.payload_ssl.self_link]
}

# Forwarding Rule
resource "google_compute_global_forwarding_rule" "payload_https_forwarding_rule" {
  name                  = "payload-https-forwarding-rule"
  target                = google_compute_target_https_proxy.payload_https_proxy.self_link
  port_range            = "443"
  load_balancing_scheme = "EXTERNAL"
  ip_address            = google_compute_global_address.load_balancer_ip.address
}

# Create the Cloud Router
resource "google_compute_router" "payload_router" {
  name    = "payload-router"
  region  = "me-west1"
  network = google_compute_network.payload_network.id
}

# Create the Cloud NAT configuration
resource "google_compute_router_nat" "payload_nat" {
  name                               = "payload-nat"
  router                            = google_compute_router.payload_router.name
  region                            = "me-west1"
  nat_ip_allocate_option            = "AUTO_ONLY"  # Automatically allocate IPs for NAT
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  # Enable endpoint independent mapping (optional)
  enable_endpoint_independent_mapping = true
}


# Output
output "load_balancer_ip" {
  value       = google_compute_global_address.load_balancer_ip.address
  description = "The IP address to configure in DNS for emda-dev.shefing.com"
}