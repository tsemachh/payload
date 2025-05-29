# Project variables - Essential for system duplication
variable "project" {
  type        = string
  default     = "emda-dev"
  description = "Google Cloud project ID"
}

variable "region" {
  type        = string
  default     = "me-west1"
  description = "Google Cloud region"
}

variable "zone" {
  type        = string
  default     = "me-west1-b"
  description = "Google Cloud zone"
}

# Prefix for resource names - Essential for system duplication
variable "prefix" {
  type        = string
  default     = "payload"
  description = "Prefix for all resource names"
}

# Domain name - Essential for system duplication
variable "domain_name" {
  type        = string
  default     = "emda-dev.shefing.com"
  description = "Domain name for the application"
}

# Health check port - Essential for system duplication
variable "health_check_port" {
  type        = number
  default     = 3000
  description = "Port for the health check and application"
}

# Docker image - Essential for system duplication
variable "docker_image" {
  type        = string
  default     = "me-west1-docker.pkg.dev/emda-dev/emda-gcr/payload-image"
  description = "Docker image for the application"
}

variable "docker_tag" {
  type        = string
  default     = "latest"
  description = "Docker image tag"
}

# Database - Essential for system duplication
variable "database_uri" {
  type        = string
  default     = "mongodb+srv://app:DuChQfEVyjQMiW6K@emda-dev-cluster.auybqem.mongodb.net/"
  description = "URI for the database"
}

variable "payload_secret" {
  type        = string
  default     = "9e9da2a4427c56cc0a45e076"
  description = "Secret for Payload CMS"
}

# GCS bucket - Essential for system duplication
variable "gcs_bucket" {
  type        = string
  default     = "emda-media"
  description = "GCS bucket for media storage"
}

# Slack webhook - Essential for system duplication
variable "slack_webhook_url" {
  type        = string
  default     = "https://hooks.slack.com/services/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"
  description = "Slack webhook URL for notifications"
}

# Logtail source token - Essential for system duplication
variable "logtail_source_token" {
  type        = string
  default     = "B5p5aFX1cPDdGdzaKHFu1Vss"
  description = "Logtail source token for logging"
}

