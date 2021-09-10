declare const getDbInstance: (logPath?: any) => {
    insert: (doc: any) => any;
    find: (query: any) => Promise<any[]>;
    findOne: (query: any) => Promise<any>;
    updateRecord: (query: any, update: any, options?: {}) => Promise<any>;
    remove: (query: any, options?: {}) => Promise<any>;
};
export default getDbInstance;
