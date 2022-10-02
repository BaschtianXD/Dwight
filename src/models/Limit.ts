import { DataTypes, InferAttributes, InferCreationAttributes, Model } from "@sequelize/core";
import { sequelize } from "../SequelizeSoundProvider";


export default class Limit extends Model<InferAttributes<Limit>, InferCreationAttributes<Limit>> {

    declare guildID: string
    declare maxsounds: Number
}

Limit.init({
    guildID: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    maxsounds: {
        type: DataTypes.SMALLINT,
        allowNull: false
    }
}, {
    timestamps: false,
    sequelize: sequelize
})