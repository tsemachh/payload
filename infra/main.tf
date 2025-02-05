provider "google" {
  project = "emda-dev"
  region  = "me-west1"
}

# GCS Bucket to store Terraform state
resource "google_storage_bucket" "terraform_state" {
  name          = "emda-terraform-state"
  location      = "me-west1"
  storage_class = "STANDARD"
  versioning {
    enabled = true
  }
  lifecycle {
    prevent_destroy = true
  }
}

# Create Artifact Registry (Private GCR)
resource "google_artifact_registry_repository" "emda_gcr" {
  provider      = google
  project       = "emda-dev"
  location      = "me-west1"
  repository_id = "emda-gcr"
  format        = "DOCKER"
  description   = "Private GCR repository for Emda project"
}

# Allow all project members to PULL images
resource "google_project_iam_binding" "gcr_reader" {
  project = "emda-dev"
  role    = "roles/artifactregistry.reader"
  members = var.pull_members
}

# Allow all project members to PUSH images
resource "google_project_iam_binding" "gcr_writer" {
  project = "emda-dev"
  role    = "roles/artifactregistry.writer"
  members = var.push_members
}


# Output the private repository URL
output "gcr_repository_url" {
  value       = "me-west1-docker.pkg.dev/emda-dev/emda-gcr"
  description = "The private GCR repository URL"
}
