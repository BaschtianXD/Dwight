import Sequelize, { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "@sequelize/core";

export default class Sound extends Model<InferAttributes<Sound>, InferCreationAttributes<Sound>> {

    declare soundID: string
    declare guildID: string
    declare soundName: string
    declare hidden: boolean
    declare deleted: CreationOptional<boolean>

    static add(sequ: Sequelize): void {
        Sound.init({
            soundID: {
                type: DataTypes.BIGINT,
                primaryKey: true
            },
            guildID: {
                type: DataTypes.BIGINT,
                allowNull: false
            },
            soundName: {
                type: DataTypes.STRING(64),
                allowNull: false
            },
            hidden: {
                type: DataTypes.BOOLEAN,
                allowNull: false
            },
            deleted: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
            }
        }, {
            timestamps: false,
            sequelize: sequ
        })
    }
}

