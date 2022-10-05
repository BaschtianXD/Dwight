import Sequelize, { DataTypes, InferAttributes, InferCreationAttributes, Model } from "@sequelize/core";


export default class Limit extends Model<InferAttributes<Limit>, InferCreationAttributes<Limit>> {

    declare guildID: string
    declare maxsounds: Number

    static add(sequ: Sequelize): void {
        Limit.init({
            guildID: {
                type: DataTypes.BIGINT,
                allowNull: false,
                primaryKey: true
            },
            maxsounds: {
                type: DataTypes.SMALLINT,
                allowNull: false
            }
        }, {
            timestamps: false,
            sequelize: sequ
        })
    }
}
