import multer from "multer"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const tempUploadDir = path.resolve(__dirname, "../../public/temp")

fs.mkdirSync(tempUploadDir, { recursive: true })

const safeFileName = (fileName) => {
  const extension = path.extname(fileName)
  const baseName = path
    .basename(fileName, extension)
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60)

  return `${Date.now()}-${Math.round(Math.random() * 1e9)}-${baseName || "upload"}${extension}`
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempUploadDir)
  },
  filename: function (req, file, cb) {
    cb(null, safeFileName(file.originalname))
  }
})

export const upload = multer({ storage,limits:{
  fileSize:500*1024*1024
}}); 
