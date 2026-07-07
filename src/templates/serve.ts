// eslint-disable-next-line
// @ts-nocheck
Bun.serve({
    port: 3000,
    fetch(req) {
        const url = new URL(req.url);

        if (url.pathname === "/") {
            return new Response(Bun.file("otp-template.html"));
        }

        return new Response("Not Found", { status: 404 });
    },
});

console.log("Server running on http://localhost:3000");
