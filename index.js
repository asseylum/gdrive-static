require("dotenv").config();
const Koa = require("koa");
const send = require("koa-send");
const NodeGoogleDrive = require("node-google-drive");
const fs = require("fs");
const compress = require("koa-compress");

const googleDriveInstance = new NodeGoogleDrive({
  ROOT_FOLDER: process.env.ROOT_FOLDER,
});

const app = new Koa();

async function main() {
  await googleDriveInstance.useServiceAccountAuth(
    JSON.parse(process.env.CREDS)
  );

  app.use(
    compress({
      threshold: 2048,
      gzip: {
        flush: require("zlib").constants.Z_SYNC_FLUSH,
      },
      deflate: {
        flush: require("zlib").constants.Z_SYNC_FLUSH,
      },
      br: false, // disable brotli
    })
  );

  app.use((ctx, next) => {
    const start = Date.now();
    return next().then(() => {
      const ms = Date.now() - start;
      console.log(`${ctx.method} ${ctx.url} - ${ms}ms`);
    });
  });

  app.use(async (ctx) => {
    const urlSpitted = ctx.url.split("/");
    const fileName = urlSpitted[urlSpitted.length - 1];
    const { files } = await googleDriveInstance.service.files.listAsync({
      q: `name = '${fileName}'`,
    });
    if (files.length) {
      const target = files[1] || files[0];

      urlSpitted.pop();
      const path = urlSpitted.join("/");
      const tempFolder = `./tmp${path}`;
      const tempFile = `./tmp${ctx.url}`;

      if (!fs.existsSync(tempFile)) {
        fs.mkdirSync(tempFolder, { recursive: true });
      }

      if (fs.existsSync(tempFile)) {
        await send(ctx, ctx.url, { root: "./tmp", maxage: 380000000, immutable: true });
      } else {
        await googleDriveInstance.getFile(target, tempFolder);
        await send(ctx, ctx.url, { root: "./tmp", maxage: 380000000, immutable: true });
      }
    } else {
      ctx.body = "Not found";
    }
  });

  app.listen(process.env.PORT || 3000);
  console.log("Listening on port: " + process.env.PORT);
}

try {
  main();
} catch (error) {
  console.log(error);
}
