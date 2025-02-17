terraform {
  backend "gcs" {
    bucket = "emda-terraform-state"
    prefix = "terraform-vm/state"
  }
}
