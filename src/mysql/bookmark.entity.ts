import { Efile } from "src/mysql/file.entity";
import { Eshared_def } from "src/mysql/shared_def.entity";
import { JoinColumn, OneToMany, OneToOne, PrimaryColumn, ViewColumn, ViewEntity } from "typeorm";

@ViewEntity({
    name: 'bookmark',
    expression:`
    select user_serial, type, issys, file_name, file_serial, last_renamed, last_modified, user_serial as reader
    from file where bookmarked='true'
	union
	select user_serial, type, issys, file.file_name, file_serial, last_renamed, last_modified, user_serial_to as reader
    from file inner join shared_def using (file_serial) where shared_def.bookmarked='true'
    `
})
export class Ebookmark{

    @ViewColumn()
    user_serial: number;

    @ViewColumn()
    type: 'dir'|'file';

    @ViewColumn()
    issys: 'false'|'true';

    @ViewColumn()
    file_name: string;

    @PrimaryColumn()
    @ViewColumn()
    file_serial: number;

    @ViewColumn()
    last_renamed: Date;

    @ViewColumn()
    last_modified: Date;

    @PrimaryColumn()
    @ViewColumn()
    reader: number;

    @ViewColumn()
    last_opened: Date;

    @OneToMany(()=>Eshared_def, (shared_def)=>shared_def.file_serial_2)
    shares: Eshared_def[];

}