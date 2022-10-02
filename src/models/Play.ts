import { Model, DataTypes, InferAttributes, InferCreationAttributes, HasOneGetAssociationMixin, NonAttribute, ForeignKey } from "@sequelize/core"
import { sequelize } from "../SequelizeSoundProvider"
import Sound from "./Sound"

export default class Play extends Model<InferAttributes<Play>, InferCreationAttributes<Play>> {

    declare userID: string
    declare soundID: ForeignKey<string>
    declare time: Date

    declare getSound: HasOneGetAssociationMixin<Sound>

    declare sound?: NonAttribute<Sound>
}

Play.init({
    userID: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    soundID: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    time: {
        type: DataTypes.DATE,
        allowNull: false
    }
}, {
    timestamps: false,
    sequelize: sequelize
})

Play.belongsTo(Sound, { foreignKey: "soundID" })
Sound.hasMany(Play, { foreignKey: "soundID" })