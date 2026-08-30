import http from "node:http";
import handler from "../api/index.js";

const port = Number(process.env.PORT || 8787);

const server = http.createServer((req, res) => {
  Promise.resolve(handler(req, res)).catch((err) => {
    res.statusCode = 500;
    res.end(String(err));
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`origin-probe-measure listening on http://127.0.0.1:${port}`);
});
