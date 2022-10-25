import { Document, Schema, Types, model } from 'mongoose';

interface IComment extends Document {
    user: Types.ObjectId;
    post: Types.ObjectId;
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

const PostModel = model<IComment>('Comment', CommentSchema);

export default PostModel;