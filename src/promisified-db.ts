import path from 'path';
import Datastore from 'nedb';

const getDbInstance = (logPath?) => {
  const dbFile = 'log-writer-db-file';
  const filename = logPath ? path.join(logPath, dbFile) : dbFile;

  const db = new Datastore({ filename, autoload: true });

  const insert = (doc): any => new Promise((res, rej) => {
    db.insert(doc, (err, newDoc) => {
      if (err) {
        rej(err);
      }
      res(newDoc);
    });
  });

  const find = (query): Promise<any[]> => new Promise((res, rej) => {
    db.find(query, (err, docs) => {
      if (err) {
        rej(err);
      }
      res(docs);
    });
  });

  const findOne = (query): Promise<any> => new Promise((res, rej) => {
    db.findOne(query, (err, docs) => {
      if (err) {
        rej(err);
      }
      res(docs);
    });
  });

  const updateRecord = (query, update, options = {}): Promise<any> => new Promise((res, rej) => {
    db.update(query, update, options, (err, numAffected) => {
      if (err) {
        rej(err);
      }
      res(numAffected);
    });
  });

  const remove = (query, options = {}): Promise<any> => new Promise((res, rej) => {
    db.remove(query, options, (err, numRemoved) => {
      if (err) {
        rej(err);
      }
      res(numRemoved);
    });
  });

  return {
    insert,
    find,
    findOne,
    updateRecord,
    remove,
  }
}

export default getDbInstance;
