import {Router} from 'express';
import { registerUser,loginUser, logoutUser,refreshAccessToken, changeCurrentPassword, getCurrentUser, updateAccountDetails, updateAccountAvatar, updateAccountCoverImage, getUserChannelProfile, getWatchHistory, deleteUserAccount} from '../controllers/user.controller.js';
import { upload } from '../middlewares/multer.middleware.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import multer from 'multer';

const router = Router();

// the upload here is represent multer middleware
router.route("/register").post(upload.fields(
    [{
        name:"avatar",
        maxCount:1
    },{
        name:"coverImage",
        maxCount:1
    }]
),registerUser) 

router.route("/login").post(loginUser);
router.route("/logout").post(verifyJWT,logoutUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/change-password").post(verifyJWT,changeCurrentPassword);
router.route("/current-user").get(verifyJWT,getCurrentUser);
router.route("/update-account").patch(verifyJWT,updateAccountDetails);
router.route("/update-avatar").patch(verifyJWT,upload.single("avatar"),updateAccountAvatar);
router.route("/update-cover-image").patch(verifyJWT,upload.single("coverImage"),updateAccountCoverImage);
router.route("/user-profile/:username").get(verifyJWT,getUserChannelProfile);
router.route("/history").get(verifyJWT,getWatchHistory);
router.route("/delete-account").delete(verifyJWT,deleteUserAccount);

export default router;   