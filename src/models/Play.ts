import { Table, Model, NotNull, Column, DataType, ForeignKey, BelongsTo, AllowNull } from "sequelize-typescript"
import Sound from "./Sound"

@Table({
    timestamps: false,
    schema: "sounds"
})
export default class Play extends Model {

    @NotNull
    @AllowNull(false)
    @Column(DataType.STRING(64))
    userID: string

    @NotNull
    @AllowNull(false)
    @ForeignKey(() => Sound)
    @Column(DataType.BIGINT)
    soundID: string

    @NotNull
    @AllowNull(false)
    @Column(DataType.DATE)
    time: Date

    @BelongsTo(() => Sound)
    sound: Sound
}