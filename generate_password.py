#!/usr/bin/env python3
"""
Helper script to generate a password hash for Granite authentication.
Usage: python generate_password.py
"""

import getpass
import bcrypt

def generate_password_hash():
    """Generate a bcrypt password hash"""
    print("=== Granite Password Hash Generator ===\n")
    
    # Get password from user (hidden input)
    password = getpass.getpass("Enter your password: ")
    password_confirm = getpass.getpass("Confirm your password: ")
    
    # Check if passwords match
    if password != password_confirm:
        print("\n[ERROR] Passwords do not match!")
        return

    if len(password) < 4:
        print("\n[WARNING] Password is too short! Use at least 8 characters for better security.")
        proceed = input("Continue anyway? (y/N): ")
        if proceed.lower() != 'y':
            return

    # Generate hash
    print("\nGenerating password hash...")
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    print("\n[OK] Password hash generated successfully!")
    print("\n" + "="*60)
    print("Copy this hash to your config.yaml:")
    print("="*60)
    print(f"\npassword_hash: \"{password_hash}\"")
    print("\n" + "="*60)
    print("\nExample config.yaml:")
    print("="*60)
    print("""
authentication:
  enabled: true
  secret_key: "your_secret_key_here"
  password_hash: "{}"
  session_max_age: 604800
""".format(password_hash))
    print("="*60)

    print("\n[NOTE] Don't forget to also set a secret key!")
    print("   Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\"")
    print("\n[SECURITY] Keep your password and secret key secure!")

if __name__ == "__main__":
    try:
        generate_password_hash()
    except KeyboardInterrupt:
        print("\n\n[CANCELLED]")
    except Exception as e:
        print(f"\n[ERROR] {e}")

