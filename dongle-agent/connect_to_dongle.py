#!/usr/bin/env python3
"""
Script de connexion SSH au dongle AutoPi avec paramiko.
Usage: python3 connect_to_dongle.py <host> <username> <password>
Ou interactif si pas d'arguments.
"""

import sys
import paramiko
import getpass


def ssh_connect_and_run(host, username, password, commands):
    """
    Se connecte au dongle via SSH et execute des commandes en lecture seule.
    """
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        print(f"[*] Connexion a {username}@{host}...")
        client.connect(host, username=username, password=password, timeout=10)
        print("[+] Connecte!\n")

        for cmd_name, cmd in commands:
            print(f"\n{'='*60}")
            print(f"[*] Execution: {cmd_name}")
            print(f"[*] Commande: {cmd}")
            print(f"{'='*60}")
            
            stdin, stdout, stderr = client.exec_command(cmd)
            output = stdout.read().decode("utf-8", errors="ignore")
            error = stderr.read().decode("utf-8", errors="ignore")

            if output:
                print(output)
            if error:
                print(f"[!] STDERR: {error}")

    except Exception as e:
        print(f"[!] Erreur: {e}")
        sys.exit(1)
    finally:
        client.close()
        print("\n[+] Deconnecte")


# ======================================================================
# Commandes de lecture seule (ne modifient rien sur le dongle)
# ======================================================================
COMMANDS = [
    ("Lister /opt/autopi", "ls -la /opt/autopi"),
    ("Lister /var/log/autopi", "ls -la /var/log/autopi"),
    ("Verifier /etc/salt/minion_id", "cat /etc/salt/minion_id 2>/dev/null || echo 'Fichier non trouve'"),
    ("Lire /etc/salt/minion (premiers 200 lignes)", "sudo sed -n '1,200p' /etc/salt/minion"),
    ("Lister fichiers /etc/autopi", "sudo find /etc/autopi -maxdepth 4 -type f 2>/dev/null | sort"),
    ("Lister fichiers /opt/autopi", "sudo find /opt/autopi -maxdepth 5 -type f | grep -Ei '\\.py$|\\.sh$|\\.conf$|\\.yaml$|\\.yml$|\\.json$' 2>/dev/null | sort | head -n 30"),
    ("Chercher url/token/api", "sudo grep -RInE 'url|endpoint|api|token|bearer|device_id|dongle|server|host|port' /etc/autopi /opt/autopi 2>/dev/null | head -n 200"),
    ("Services AutoPi actifs", "sudo systemctl list-units --type=service | grep -Ei 'autopi|salt|mqtt|mosquitto|network'"),
    ("Lister /var/log/autopi fichiers", "sudo find /var/log/autopi -maxdepth 3 -type f 2>/dev/null | sort"),
]


def main():
    if len(sys.argv) == 4:
        host = sys.argv[1]
        username = sys.argv[2]
        password = sys.argv[3]
    else:
        print("=== Connexion SSH AutoPi (lecture seule) ===\n")
        host = input("Adresse IP du dongle [192.168.1.147]: ").strip() or "192.168.1.147"
        username = input("Utilisateur [pi]: ").strip() or "pi"
        password = getpass.getpass("Mot de passe: ")

    print(f"\nHost: {host}")
    print(f"User: {username}")
    print(f"Commands: {len(COMMANDS)}")
    print()

    ssh_connect_and_run(host, username, password, COMMANDS)


if __name__ == "__main__":
    main()
