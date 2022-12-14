
import ServerException from '../Exception/ServerException';
import Routable from '../Interface/Routable';
import IsAuthenticated from '../Middlewares/IsAuthenticated';

import { IMedia, Media } from '../Schema/MediaSchema';
import { Router, Response, Request } from 'express';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { User } from '../Schema/UserSchema';
import { join, resolve } from 'path';
import { v4 as uuidv4 } from 'uuid';

import multer, { diskStorage } from 'multer';

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

            const user = await User.findById(request.session.user.id, {
                _id: 1
            });

            if (!user){
                throw(new ServerException(['Non autorisé'], 401));
            }

            if (!request.file){
                throw(new ServerException(['Le paramètre media ne doit pas être indéfini'], 400));
            }

            const newMedia = new Media({
                user: user._id,
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
                errors: error instanceof ServerException ? error.messages : ['Erreur interne du serveur']
            });
        }
    }

    saveBase64 = async (str: string, userId: string): Promise<IMedia> =>
    {
        try {

            const types = {
                '/': 'jpeg',
                'i': 'png',
                'R': 'gif',
                'U': 'webp'
            };

            str = str.replace(/^data:image\/\w+;base64,/, '');

            if (!types[str[0]]){
                throw(new ServerException(['Type de fichier non supporté'], 400));
            }

            const filename = `${uuidv4()}.${types[str[0]]}`;
            const uploadDir = join(`${resolve('./')}/public/uploads/`);
            const buffer = Buffer.from(str, 'base64');
            writeFileSync(`${uploadDir}${filename}`, buffer);
    
            const newMedia = new Media({
                user: userId,
                url: `${process.env.SERVER_URL}/media/${filename}`,
                mimetype: `image/${types[str[0]]}`,
                filename: filename,
                originalname: filename,
                path: `public\\uploads\\${filename}`,
                size: buffer.length
            });
    
            if (!await newMedia.save()){
                throw(new Error('Failed to save Media'));
            }

            return (newMedia);

        } catch(error) {
            throw(new Error('Failed to saveBase64 Media'));
        }
    }

    delete = async (request: Request, response: Response) =>
    {
        try {

            const media = await Media.findById(request.params.mediaId, {
                _id: 1, path: 1
            });
    
            if (!media) {
                throw new ServerException([`media ${request.params.mediaId} n'existe pas`], 400);
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
                errors: error instanceof ServerException ? error.messages : ['Erreur interne du serveur']
            });
        }
    }
}