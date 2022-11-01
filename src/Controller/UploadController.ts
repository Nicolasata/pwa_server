
import ServerException from '../Exception/ServerException';
import Routable from '../Interface/Routable';
import IsAuthenticated from '../Middlewares/IsAuthenticated';

import { Media } from '../Schema/MediaSchema';
import { Router, Response, Request } from 'express';
import multer, { diskStorage } from 'multer';
import { existsSync, unlinkSync } from 'fs';

export default class UploadController implements Routable
{
    route: string;
    router: Router;
    constructor()
    {
        this.router = Router();
        this.route = '/upload';
    }

    initialiseRouter()
    {
        const upload = multer({
            storage: diskStorage({
                destination: (request, file, callback) => {
                    callback(null, './public/uploads/');
                },
                filename: (request, file, callback) => {
                    callback(null, `${Date.now()}_${file.originalname}`);
                }
            })
        });

        this.router.post('/save', IsAuthenticated, upload.single('media'), this.save);
        this.router.delete('/delete/:mediaId', IsAuthenticated, this.delete);
    }

    save = async (request: Request, response: Response) =>
    {
        try {

            if (!request.file){
                throw(new ServerException(['file should not be undefined'], 400));
            }

            const newMedia = new Media({
                user: request.session.user.id,
                url: `${process.env.SERVER_URL}/media/${request.file.filename}`,
                ...request.file
            });
        
            if (!await newMedia.save()){
                throw(new Error('Failed to save Media'));
            }

            response
            .status(201)
            .send({
                media: newMedia._id
            });
        
        } catch(error){

            response
            .status(error instanceof ServerException ? error.httpCode : 500)
            .send({
                errors: error instanceof ServerException ? error.messages : ['Internal server error']
            });
        }
    }

    delete = async (request: Request, response: Response) =>
    {
        try {

            const media = await Media.findById(request.params.mediaId, {
                _id: 1, path: 1
            });
    
            if (!media) {
                throw new ServerException([`Media with _id ${request.params.mediaId} does not exists`], 400);
            }
    
            if (existsSync(media.path)){
                unlinkSync(media.path);
            }
    
            if (!await Media.deleteOne({_id: media._id})){
                throw new Error(`Failed to delete media with _id ${media._id}`);
            }

            response
            .status(204)
            .send();

        } catch(error){

            response
            .status(error instanceof ServerException ? error.httpCode : 500)
            .send({
                errors: error instanceof ServerException ? error.messages : ['Internal server error']
            });
        }
    }
}