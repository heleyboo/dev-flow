# DevFlow — Product Requirements Document

## 1. Tổng quan

**DevFlow** là một CLI tool + Web Dashboard dành cho PHP backend developer, tự động hóa toàn bộ workflow từ khi nhận task đến khi deploy code.

### 1.1 Vấn đề cần giải quyết

Developer hiện đang làm thủ công các bước sau:

1. Mở Jira → đọc task → copy thông tin
2. Mở Figma → xem design → ghi chú specs
3. Mở SRS → tìm phần liên quan → trích xuất requirements
4. Tổng hợp tất cả thành prompt cho Claude Code
5. Review code → tạo branch → commit → push → tạo PR
6. Chạy lệnh deploy thủ công

**Bottleneck lớn nhất**: Bước 1-4 (hệ thống hóa tài liệu) chiếm ~30-40% thời gian làm việc.

### 1.2 Giải pháp

DevFlow tự động hóa toàn bộ pipeline trên thành **một lệnh duy nhất** hoặc vài click trên dashboard.

### 1.3 Tech Stack

- **Runtime**: Node.js >= 18 (LTS)
- **CLI Framework**: Commander.js + Inquirer.js (interactive prompts)
- **Web UI**: Express.js backend + React frontend (optional)
- **Package Manager**: npm
- **Config Format**: YAML (`.devflow.yml` tại root project)

### 1.4 Kiến trúc tổng quan

```
devflow/
├── bin/
│   └── devflow.js              # CLI entry point
├── src/
│   ├── commands/               # CLI commands
│   │   ├── init.js             # devflow init
│   │   ├── task.js             # devflow task <JIRA-ID>
│   │   ├── figma.js            # devflow figma <URL>
│   │   ├── prompt.js           # devflow prompt <JIRA-ID>
│   │   ├── ship.js             # devflow ship <JIRA-ID>
│   │   ├── deploy.js           # devflow deploy
│   │   ├── test-api.js         # devflow test:api
│   │   └── test-e2e.js         # devflow test:e2e
│   ├── services/               # Business logic
│   │   ├── jira.service.js
│   │   ├── figma.service.js
│   │   ├── git.service.js
│   │   ├── deploy.service.js
│   │   ├── prompt.service.js
│   │   ├── api-test.service.js
│   │   └── e2e-test.service.js
│   ├── templates/              # Prompt templates
│   │   ├── api-endpoint.hbs
│   │   ├── crud-feature.hbs
│   │   ├── bug-fix.hbs
│   │   ├── fe-component.hbs
│   │   ├── fe-page.hbs
│   │   └── custom.hbs
│   ├── generators/             # Test generators
│   │   ├── api-test.generator.js
│   │   ├── e2e-test.generator.js
│   │   ├── page-object.generator.js
│   │   ├── postman.generator.js
│   │   └── http-file.generator.js
│   ├── utils/
│   │   ├── config.js           # Load .devflow.yml
│   │   ├── logger.js
│   │   └── api-client.js       # HTTP wrapper
│   └── web/                    # Optional web dashboard
│       ├── server.js
│       ├── api/
│       └── frontend/
├── .devflow.yml                # Per-project config
├── package.json
└── README.md
```

### 1.5 Config File (`.devflow.yml`)

```yaml
# .devflow.yml — đặt tại root của project

project:
  name: "my-php-project"
  type: "laravel"                    # laravel | symfony | vanilla
  php_version: "8.2"

jira:
  host: "https://your-company.atlassian.net"
  email: "dev@company.com"
  # API token lưu trong env var DEVFLOW_JIRA_TOKEN
  project_key: "PROJ"
  custom_fields:                     # Map custom fields nếu cần
    srs_link: "customfield_10001"
    figma_link: "customfield_10002"
    api_specs: "customfield_10003"

figma:
  # Personal access token lưu trong env var DEVFLOW_FIGMA_TOKEN
  default_project: "your-figma-project-id"

git:
  branch_prefix: "feature"           # feature | fix | hotfix
  branch_format: "{prefix}/{jira_id}-{short_desc}"
  commit_format: "[{jira_id}] {type}: {message}"
  remote: "origin"
  base_branch: "develop"
  auto_push: true
  create_pr: true
  pr_template: ".github/PULL_REQUEST_TEMPLATE.md"

deploy:
  staging:
    type: "ssh"                      # ssh | docker | k8s | custom
    host: "staging.company.com"
    user: "deployer"
    path: "/var/www/staging"
    commands:
      - "cd {path} && git pull origin develop"
      - "composer install --no-dev"
      - "php artisan migrate --force"
      - "php artisan cache:clear"
      - "php artisan queue:restart"
  production:
    type: "ssh"
    host: "prod.company.com"
    user: "deployer"
    path: "/var/www/production"
    requires_approval: true
    commands:
      - "cd {path} && git pull origin main"
      - "composer install --no-dev --optimize-autoloader"
      - "php artisan migrate --force"
      - "php artisan config:cache"
      - "php artisan route:cache"
      - "php artisan queue:restart"
      - "sudo systemctl reload php8.2-fpm"

prompt:
  output_dir: ".devflow/prompts"     # Nơi lưu generated prompts
  template: "auto"                   # auto-detect hoặc chỉ định template
  include_db_schema: true            # Attach relevant DB schema
  include_existing_code: true        # Attach related existing code
  max_context_files: 10              # Giới hạn số file attach
  language: "vi"                     # Ngôn ngữ output prompt

frontend:
  framework: "react"                 # react | vue | nextjs | nuxtjs | angular
  styling: "tailwindcss"             # tailwindcss | scss | styled-components
  language: "typescript"             # typescript | javascript
  state_management: "zustand"        # zustand | redux | pinia | vuex
  api_client: "axios"               # axios | fetch | tanstack-query | swr
  ui_library: "shadcn"              # shadcn | antd | mui | none
  src_dir: "src"
  component_dir: "src/components"
  page_dir: "src/pages"
  api_dir: "src/api"

test:
  api:
    base_url: "http://localhost:8000"
    auth:
      type: "bearer"
      login_endpoint: "/api/auth/login"
      login_body:
        email: "test@example.com"
        password: "password123"
      token_path: "data.token"
    default_format: "all"            # http | postman | jest | phpunit | all
    output_dir: ".devflow/tests"
  e2e:
    framework: "playwright"          # playwright | cypress
    language: "typescript"
    base_url: "http://localhost:3000"
    output_dir: "tests/e2e"
    browsers: ["chromium"]
    screenshot_on_fail: true
```
