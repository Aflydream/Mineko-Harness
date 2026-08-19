# AGENTS.md — GitHub Actions

Run jobs on Windows runners (`windows-*` labels) under native `pwsh`. The pull-request `windows` job is the deliberate exception: it runs Windows Node under Wine on hosted Linux and blocks `all checks passed`; `windows-native` runs automatically on `windows-2025` (or the self-hosted `[self-hosted, mnh-win-ci, windows]` pool under `MNH_CI_FAILOVER_WINDOWS=selfhosted`) but reports independently. The master `serial-windows` standby continuously validates the self-hosted failover target — see the [failover runbook](../AgentGuide/development.md).
