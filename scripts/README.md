# Scripts

Utility scripts for Granite development and maintenance.

## Available Scripts

### run_tests.sh / run_tests.bat

Run the test suite inside the Docker container.

**Usage:**

```bash
# Linux/Mac (make sure the file has LF line endings)
./scripts/run_tests.sh

# Or if you prefer
scripts/run_tests.sh

# Windows
scripts\run_tests.bat
```

**Note:** The script must have Unix (LF) line endings to work on Linux/Mac. If you edited it on Windows, convert the line endings:

```bash
# Convert Windows (CRLF) to Unix (LF) line endings
sed -i 's/\r$//' scripts/run_tests.sh
chmod +x scripts/run_tests.sh
```

**What it does:**
1. Checks if the Granite container is running
2. Executes pytest inside the container
3. Displays test results
4. Provides URL for frontend tests

**Requirements:**
- Docker must be running
- Granite container must be started (`docker-compose up -d`)

## Adding New Scripts

When adding new scripts to this directory:

1. Use `.sh` extension for Bash scripts (Linux/Mac)
2. Use `.bat` extension for Windows batch files
3. Make Bash scripts executable: `chmod +x scripts/your_script.sh`
4. Document the script in this README
5. Keep scripts simple and focused on a single task

## Script Organization

All utility scripts should be placed in this directory to keep the root directory clean:

```
scripts/
├── README.md           # This file
├── run_tests.sh        # Run tests (Linux/Mac)
└── run_tests.bat       # Run tests (Windows)
```

## Future Script Ideas

Consider adding scripts for:
- Database migrations (if added)
- Backup/restore operations
- Plugin installation helpers
- Theme compilation/validation
- Development environment setup
- Log analysis tools
