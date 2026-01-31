import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";


const registerUser = asyncHandler(async (req,res)=>{

    // get user detail from frontend
    // validation - not empty
    // check if user already exist:username, email
    // check for images,check for avatar
    // upload them to cloudinary , avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation 
    // return response 

    const {email,fullName,username,password} = req.body
    
    if(!fullName||!username||!email||!password){
        throw new ApiError(400,"All fields are required");
    }

    console.log(req.body);
    
    const existedUser = User.findOne({
        $or:[{email},{username}]
    })

    if(existedUser){
        throw new ApiError(409,"User Already Existed");
    }

    // get file paths from multer
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required");
    }

    // upload on cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(400,"Avatar file is required");
    }

    // create user entry in db
    const user = await User.create({
        fullName,
        avatar:avatar.url,
        coverImage:coverImage?.url || "",
        email,
        password,
        username:username.toLowerCase()
    })
    
    // remove password and refresh token from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );
    
    // check for user creation
    if(!createdUser){
        throw new ApiError(500,"Something went worng while register a user");
    }

    return res.status(201).json(
        new ApiResponse(200,createdUser,"User register succesfully")
    )
})

export {registerUser}