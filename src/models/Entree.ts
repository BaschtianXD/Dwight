import { DataTypes, ForeignKey, HasOneGetAssociationMixin, InferAttributes, InferCreationAttributes, Model, NonAttribute } from "@sequelize/core"
import { sequelize } from "../SequelizeSoundProvider"
import Sound from "./Sound"

export default class Entree extends Model<InferAttributes<Entree>, InferCreationAttributes<Entree>> {

    declare guildID: string
    declare userID: string
    declare soundID: ForeignKey<string>

    declare getSound: HasOneGetAssociationMixin<Sound>

    declare sound?: NonAttribute<Sound>
}

Entree.init({
    guildID: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    userID: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    soundID: {
        type: DataTypes.BIGINT,
        allowNull: false
    }
}, {
    timestamps: false,
    sequelize: sequelize
})

Entree.belongsTo(Sound, { foreignKey: "soundID" })
Sound.hasMany(Entree, { foreignKey: "soundID" })