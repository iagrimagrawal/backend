import {v2 as cloudinary} from 'cloudinary';
import fs from "fs"

const removeLocalFile = (localFilePath) => {
    if(localFilePath && fs.existsSync(localFilePath)){
        fs.unlinkSync(localFilePath);
    }
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async(localFilePath) =>{
    try{
        if(!localFilePath) return null;
        // upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath,{
            resource_type:"auto"
        })

        // remove the file from local storage
        removeLocalFile(localFilePath);
        return response;
    }catch(error){
        removeLocalFile(localFilePath);
        return null;
    }
}

const deleteFromCloudinary = async(publicId) =>{
    try {
        if(!publicId) return null;
        const response = await cloudinary.uploader.destroy(publicId)
        return response;
    }
    catch (error) {
        return null;
    }
}

export {uploadOnCloudinary, deleteFromCloudinary}
