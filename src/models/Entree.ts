import Sequelize, { DataTypes, ForeignKey, HasOneGetAssociationMixin, InferAttributes, InferCreationAttributes, Model, NonAttribute } from "@sequelize/core"
import Sound from "./Sound"

export default class Entree extends Model<InferAttributes<Entree>, InferCreationAttributes<Entree>> {

    declare guildID: string
    declare userID: string
    declare soundID: ForeignKey<string>

    declare getSound: HasOneGetAssociationMixin<Sound>

    declare sound?: NonAttribute<Sound>

    static add(sequ: Sequelize): void {
        Entree.init({
            guildID: {
                type: DataTypes.BIGINT,
                allowNull: false,
                primaryKey: true
            },
            userID: {
                type: DataTypes.BIGINT,
                allowNull: false,
                primaryKey: true
            },
            soundID: {
                type: DataTypes.BIGINT,
                allowNull: false
            }
        }, {
            timestamps: false,
            sequelize: sequ
        })

        Entree.belongsTo(Sound, { foreignKey: "soundID" })
        Sound.hasMany(Entree, { foreignKey: "soundID" })
    }
}

