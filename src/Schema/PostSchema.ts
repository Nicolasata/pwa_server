import { Document, Schema, Types, model } from 'mongoose';

interface IPost extends Document {
    user: Types.ObjectId;
    media: Types.ObjectId;
    likes: Types.ObjectId[];
    description: string;
};

const PostSchema = new Schema<IPost>({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    media: {
        type: Schema.Types.ObjectId,
        ref: 'Media',
        default: null
    },
    likes: {
        type: [Schema.Types.ObjectId],
        ref: 'User',
        default: []
    },
    description: {
        type: String,
        default: null
    }
},
{
    timestamps: true,
    collection: 'posts'
});

const PostModel = model<IPost>('Post', PostSchema);

export default PostModel;