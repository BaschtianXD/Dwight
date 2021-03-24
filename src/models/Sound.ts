import { Table, Model, PrimaryKey, Column, DataType, NotNull, Default, AllowNull, HasMany } from "sequelize-typescript"
import Entree from "./Entree"
import Play from "./Play"

@Table({
    timestamps: false,
    schema: "sounds"
})
export default class Sound extends Model {
    @PrimaryKey
    @Column(DataType.BIGINT)
    soundID: string

    @NotNull
    @AllowNull(false)
    @Column(DataType.BIGINT)
    guildID: string

    @NotNull
    @AllowNull(false)
    @Column(DataType.STRING(64))
    soundName: string

    @Default(false)
    @NotNull
    @AllowNull(false)
    @Column(DataType.BOOLEAN)
    hidden: boolean

    @Default(false)
    @NotNull
    @AllowNull(false)
    @Column(DataType.BOOLEAN)
    deleted: boolean

    @HasMany(() => Entree)
    entrees: Entree[]

    @HasMany(() => Play)
    plays: Play[]

}