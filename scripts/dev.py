# Launch docker compose and dev server. Gracefully shutdown docker compose on exit
import subprocess
import sys


if __name__ == "__main__":
    try:
        subprocess.run(["docker", "compose", "up", "-d"])
        subprocess.run(["npm", "run", "dev"])
    except KeyboardInterrupt:
        print("Keyboard interrupt")
    finally:
        print("Cleaning up...")
        subprocess.run(["docker", "compose", "down"])
        print("Done")
        sys.exit(0)
