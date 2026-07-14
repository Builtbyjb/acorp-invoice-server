
# npx drizzle-kit generate --custom --name=seed_roles --config=./drizzle.config.ts --out=./drizzle/custom
import subprocess

if __name__ == "__main__":
    try:
        subprocess.run(["npx", "drizzle-kit", "generate"], check=True)
        subprocess.run(["npx", "drizzle-kit", "migrate", "--config=./drizzle.config.ts"], check=True)
        subprocess.run(["npx", "drizzle-kit", "migrate", "--config=./drizzle.custom.config.ts"], check=True)
    except Exception as e:
        print(e)
