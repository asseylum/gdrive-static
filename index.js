require("dotenv").config();
const Koa = require("koa");
const send = require("koa-send");
const logger = require('koa-logger')
const NodeGoogleDrive = require("node-google-drive");
const fs = require("fs");
const compress = require("koa-compress");

const googleDriveInstance = new NodeGoogleDrive({
  ROOT_FOLDER: process.env.ROOT_FOLDER,
});

const app = new Koa();

const getTargetFolder = async (
  folders,
  index = 0,
  folder = process.env.ROOT_FOLDER
) => {
  const target = folders[index];
  const { files } = await googleDriveInstance.service.files.listAsync({
    q: `name = '${target}' and mimeType = 'application/vnd.google-apps.folder' and '${folder}' in parents`,
    fields: "files(id, name), files/parents",
  });

  if (files.length === 0) {
    return null;
  }

  if (folders.length > index + 1) {
    const result = await getTargetFolder(folders, index + 1, files[0].id);

    return result;
  }

  return files[0].id;
};

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

  app.use(logger())

  app.use(async (ctx) => {
    const urlSpitted = ctx.url.split("/").filter(Boolean);
    const fileName = urlSpitted[urlSpitted.length - 1];
    urlSpitted.pop();
    const path = urlSpitted.join("/");
    const tempFolder = `./tmp/${path}`;
    const tempFile = `./tmp${ctx.url}`;

    if (!fs.existsSync(tempFile)) {
      const folder = await getTargetFolder(urlSpitted);
      if (!folder) {
        ctx.body = "Not found"
        return
      }

      const { files } = await googleDriveInstance.service.files.listAsync({
        q: `name = '${fileName}' and '${folder}' in parents`,
        fields: "files(id, name, mimeType), files/parents",
      });

      const [target] = files;

      if (!target) {
        ctx.body = "Not found"
        return
      }

      fs.mkdirSync(tempFolder, { recursive: true });
      await googleDriveInstance.getFile(target, tempFolder);
    }

    await send(ctx, ctx.url, {
      root: "./tmp",
      maxage: 380000000,
      immutable: true,
    });
  });

  app.listen(process.env.PORT || 3000);
  console.log("Listening on port: " + process.env.PORT);
}

try {
  if (!process.env.CREDS) {
    throw new Error('No creds has been provided')
  }

  if (!process.env.ROOT_FOLDER) {
    throw new Error('No root folder has been provided')
  }

  main();
} catch (error) {
  console.log(error);
}
