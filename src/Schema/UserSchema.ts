import { Document, Schema, Types, model } from 'mongoose';

interface IUser extends Document {
    username: string;
    password: string;
    description: string;
    email: string;
    media: Types.ObjectId;
    followers: Types.ObjectId[],
    following: Types.ObjectId[],
    likes: Types.ObjectId[],
    deletedAt: Date;
};

const UserSchema = new Schema<IUser>({
    username: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: null
    },
    email: {
        type: String,
        required: true
    },
    media: {
        type: Schema.Types.ObjectId,
        ref: 'Media',
        default: null
    },
    followers: {
        type: [Schema.Types.ObjectId],
        ref: 'User',
        default: []
    },
    following: {
        type: [Schema.Types.ObjectId],
        ref: 'User',
        default: []
    },
    likes: {
        type: [Schema.Types.ObjectId],
        ref: 'Post',
        default: []
    },
    deletedAt: {
        type: Date,
        default: null
    }
},
{
    timestamps: true,
    collection: 'users'
});

const UserModel = model<IUser>('User', UserSchema);

export default UserModel;