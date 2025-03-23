variable "pull_members" {
  type = list(string)
  default = [
    "group:dev@shefing.com",
    "serviceAccount:terraform-sa@emda-dev.iam.gserviceaccount.com"
  ]
}

variable "push_members" {
  type = list(string)
  default = [
    "user:channahk@shefing.com",
    "user:philc@shefing.com",
    "user:tsemachh@shefing.com",
    "user:michalk@shefing.com" , 
    "serviceAccount:terraform-sa@emda-dev.iam.gserviceaccount.com"
  ]
}
