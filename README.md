# gdrive-static

Serve a static folder from google drive.

```
ROOT_FOLDER=root folder id
CREDS=google service account creds
```

Share the root folder with service account first. Files should have unique names for accuracy. It will take fist folder/file from your gdrive to response. Duplicated files/folder (same names) can be skipped.
