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