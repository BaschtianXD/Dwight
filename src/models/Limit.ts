import { Table, Model, PrimaryKey, Column, DataType, NotNull, AllowNull } from "sequelize-typescript"

@Table({
    timestamps: false,
    schema: "sounds"
})
export default class Limit extends Model {

    @PrimaryKey
    @Column(DataType.BIGINT)
    guildID: string

    @NotNull
    @AllowNull(false)
    @Column(DataType.SMALLINT)
    maxsounds: Number
}