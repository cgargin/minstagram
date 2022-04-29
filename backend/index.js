/* Dependencies */
const express = require("express");
const admin = require("firebase-admin");
const busboy = require("busboy");
let path = require("path");
let os = require("os");
let fs = require("fs");
let UUID = require("uuid-v4");

/* Config.express */
const app = express();

/* Config firebase */

const serviceAccount = require("./sak.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "minstagram-9ad16.appspot.com",
});
const db = admin.firestore();
let bucket = admin.storage().bucket();

/* end point - posts */
app.get("/posts", (request, response) => {
  response.set("Access-Control-Allow-Origin", "*");
  let posts = [];
  db.collection("posts")
    .orderBy("date", "desc")
    .get()
    .then((snapshot) => {
      snapshot.forEach((doc) => {
        posts.push(doc.data());
      });
      response.send(posts);
    });
});

/* end point - createPos */
app.post("/createPost", (request, response) => {
  response.set("Access-Control-Allow-Origin", "*");

  let uuid = UUID();

  const bb = busboy({ headers: request.headers });
  let fields = {};
  let fileData = {};

  bb.on("file", (name, file, info) => {
    const { filename, encoding, mimeType } = info;
    console.log(
      `File [${name}]: filename: %j, encoding: %j, mimeType: %j`,
      filename,
      encoding,
      mimeType
    );
    // /tmp/43434-43434.png
    let filePath = path.join(os.tmpdir(), filename);
    file.pipe(fs.createWriteStream(filePath));
    fileData = { filePath, mimeType };
  });

  bb.on("field", (name, val, info) => {
    fields[name] = val;
  });

  bb.on("close", () => {
    console.log("şimdi fileupload");
    bucket.upload(
      fileData.filePath,
      {
        uploadType: "media",
        metadata: {
          metadata: {
            contentType: fileData.mimeType,
            firebaseStorageDownloadTokens: uuid,
          },
        },
      },
      (err, uploadedFile) => {
        if (!err) {
          console.log(uploadedFile);
          createDocument(uploadedFile);
        } else {
          console.log(err);
        }
      }
    );

    function createDocument(uploadedFile) {
      console.log("Create Document");
      db.collection("posts")
        .doc(fields.id)
        .set({
          id: fields.id,
          caption: fields.caption,
          location: fields.location,
          date: parseInt(fields.date),
          imageUrl: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${uploadedFile.name}?alt=media&token=${uuid}`,
        })
        .then(() => {
          console.log("EVERYTHING OK");
          response.send("Post Added:" + fields.id);
        })
        .catch((error) => {
          console.error("Error writing document: ", error);
        });
    }

    //  response.writeHead(303, { Connection: "close", Location: "/" });
  });
  // Add a new document in collection "cities"

  request.pipe(bb);
});

/* listen */
app.listen(process.env.PORT || 3000);
