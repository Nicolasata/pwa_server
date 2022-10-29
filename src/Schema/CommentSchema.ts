import { Document, Schema, model } from 'mongoose';
import { IPost } from './PostSchema';
import { IUser } from './UserSchema';

export interface IComment extends Document
{
    user: IUser;
    post: IPost;
    text: string;
};

const CommentSchema = new Schema<IComment>({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    post: {
        type: Schema.Types.ObjectId,
        ref: 'Post',
        required: true
    },
    text: {
        type: String,
        required: true
    }
},
{
    timestamps: true,
    collection: 'comments'
});

export const Comment = model<IComment>('Comment', CommentSchema);