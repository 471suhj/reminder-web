export class EncryptError extends Error{
    encr_type: "expired" | "internal";
    encr_data: Error;

    constructor(type: "expired" | "internal", data?: Error){
        super();
        this.encr_type = type;
        if (data){
            this.encr_data = data;
        }
    }

}