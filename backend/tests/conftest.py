def pytest_terminal_summary(terminalreporter, exitstatus, config):
    passed = len(terminalreporter.stats.get("passed", []))
    failed = len(terminalreporter.stats.get("failed", []))

    if exitstatus == 0:
        print("\n")
        print("=" * 60)
        print(f"  ✅  {passed} fonctions testées — TOUT FONCTIONNE AVEC SUCCÈS")
        print("=" * 60)
    else:
        print("\n")
        print("=" * 60)
        print(f"  ✅  {passed} fonctions OK")
        print(f"  ❌  {failed} fonctions EN ERREUR")
        print("=" * 60)
