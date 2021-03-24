import { Table, Model, PrimaryKey, Column, DataType, ForeignKey, BelongsTo, AllowNull, NotNull } from "sequelize-typescript"
import Sound from "./Sound"

@Table({
    timestamps: false,
    schema: "sounds"
})
export default class Entree extends Model {

    @PrimaryKey
    @Column(DataType.BIGINT)
    guildID: string

    @PrimaryKey
    @Column(DataType.BIGINT)
    userID: string

    @ForeignKey(() => Sound)
    @AllowNull(false)
    @NotNull
    @Column(DataType.BIGINT)
    soundID: string

    @BelongsTo(() => Sound)
    sound: Sound
}