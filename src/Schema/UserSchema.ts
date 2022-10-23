import { Document, Schema, Types, model  } from 'mongoose';

interface IUser extends Document {
    username: string;
    password: string;
    description: string;
    email: string;
    avatar: Types.ObjectId;
    subscribers: [],
    verified: boolean;
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
    avatar: {
        type: Schema.Types.ObjectId,
        ref: 'Media',
        default: null
    },
    subscribers: {
        type: [Schema.Types.ObjectId],
        ref: 'User',
        default: []
    },
    verified: {
        type: Boolean,
        default: false
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