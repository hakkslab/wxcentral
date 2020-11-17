import { Dictionary, GenericObject } from '../interfaces/common';
import db from './Db';

export enum ColumnTypes {
  Number = 'number',
  String = 'string',
  Boolean = 'boolean',
}

export interface ColumnDescriptor {
  /**
   * The name of the column in the database
   */
  name: string;

  /**
   * The column's data type
   */
  type: ColumnTypes;

  /**
   * If this column can have a null value
   */
  nullable?: Boolean;

  /**
   * If this column is a primary key
   */
  primaryKey?: boolean;
}

type WhereClause = {
  sql: string,
  params: Dictionary<any>,
};

// Methods that generate WHERE clause conditionals from a select conditions object
type WhereOperatorGenerator = (field: ColumnDescriptor, value: any) => WhereClause;
const WHERE_OPERATORS: Dictionary<WhereOperatorGenerator> = {
  eq: (field: ColumnDescriptor, value: any): WhereClause => (
    {
      sql: `\`${field.name}\` = \$${field.name}`,
      params: { [`\$${field.name}`]: value },
    }
  ),
  gte: (field: ColumnDescriptor, value: any): WhereClause => (
    {
      sql: `\`${field.name}\` >= \$${field.name}`,
      params: { [`\$${field.name}`]: value },
    }
  ),
  gt: (field: ColumnDescriptor, value: any): WhereClause => (
    {
      sql: `\`${field.name}\` > \$${field.name}`,
      params: { [`\$${field.name}`]: value },
    }
  ),
  lt: (field: ColumnDescriptor, value: any): WhereClause => (
    {
      sql: `\`${field.name}\` < \$${field.name}`,
      params: { [`\$${field.name}`]: value },
    }
  ),
  lte: (field: ColumnDescriptor, value: any): WhereClause => (
    {
      sql: `\`${field.name}\` <= \$${field.name}`,
      params: { [`\$${field.name}`]: value },
    }
  ),
  between: (field: ColumnDescriptor, values: Array<number>): WhereClause => (
    {
      sql: `\`${field.name}\` BETWEEN \$${field.name}1 AND \$${field.name}2`,
      params: { [`$${field.name}1`]: values[0], [`$${field.name}2`]: values[1] },
    }
  ),
};

export abstract class DbModel {
  // Makes TS happy with the freeform keys in `mysqlCopyFromRow`
  [key:string]: any;

  /**
   * The name of the database table
   */
  private static _dbTable: string;

  /**
   * A mapping of object properties to their respective database fields
   */
  private static _dbFields: Dictionary<ColumnDescriptor>;

  /**
   * The name of the object property that is the primary key in the database
   */
  private static _dbPrimaryKey?: string;

  /**
   * Returns a list of fields that can be inserted/updated on this table
   */
  private get _updatableFields(): Array<string> {
    const constructor = <typeof DbModel>this.constructor;
    const { _dbFields, _dbPrimaryKey } = constructor;
    return Object.keys(_dbFields)
      .filter(field => field !== _dbPrimaryKey);
  }

  private _getUpdatableFieldsQueryObject(fields: Array<string>): Dictionary<any> {
    return fields.reduce((obj: Dictionary<any>, key: string) => {
      obj[`$${key}`] = this[key];
      return obj;
    }, {});
  }

  /**
   * To be implemented by the extended class so that instances of
   * that can be instantiated from within this abstract class.
   */
  public static create(): DbModel {
    throw new Error('[DbModel] "create" method must be overridden by the extending class');
  }

  /**
   * Copies database information into the instantiated object
   *
   * @param row The row object returned from a database query
   * @param fieldMap The object -> database field map
   */
  public mysqlCopyFromRow(row: Dictionary<any>) {
    const constructor = <typeof DbModel>this.constructor;
    const { _dbFields } = constructor;
    Object.keys(_dbFields).forEach((key: string) => {
      const mysqlField = _dbFields[key].name;
      this[key] = row[mysqlField];
    });
  }

  /**
   * Creates an instance of this model from a plain object with
   * property and type validation
   *
   * @param {GenericObject} obj The object to create the instance from
   * @return {DbModel} The model instance
   */
  public static createFromObject(obj: GenericObject): DbModel {
    const retObj = <DbModel>this.create();
    const { _dbFields } = <typeof DbModel>retObj.constructor;
    const errors = Object.keys(_dbFields).reduce((errs: Array<string>, key: string) => {
      const schema = _dbFields[key];
      let valid = true;
      if (obj.hasOwnProperty(key) && !schema.nullable) {
        switch (schema.type) {
          case ColumnTypes.Number:
            valid = !Number.isNaN(obj[key] - 0);
            break;
          case ColumnTypes.Boolean:
            valid = obj[key] === true || obj[key] === false;
            break;
        }

        if (!valid) {
          errs.push(`Expected type ${schema.type} for column "${key}". Got: ${obj[key]}`);
        }
      } else if (!obj.hasOwnProperty(key) && !schema.nullable && key !== this._dbPrimaryKey) {
        errs.push(`Expected value for column "${key}"`);
      }

      return errs;
    }, []);

    if (errors.length) {
      console.error(errors);
      return null;
    }

    // Copy all the properties over to the new instance
    Object.keys(_dbFields).forEach(key => retObj[key] = obj[key]);
    return retObj;
  }

  /**
   * Saves the current model to database. Will INSERT if no ID is present (as defined
   * by the `primaryKey` and UPDATE if it is. On INSERT, will update the object's ID
   * as defined by `primaryKey`.
   *
   * @param db The database connection
   * @return {boolean} If the operation was successful
   */
  public async sync(): Promise<void> {
    const constructor = <typeof DbModel>this.constructor;

    if (!this[constructor._dbPrimaryKey]) {
      return this._insert();
    }

    return this._update();
  }

  /**
   * INSERTs the object into the database
   *
   * @param db
   */
  private async _insert(): Promise<void> {
    const constructor = <typeof DbModel>this.constructor;

    constructor._verifyFields();

    const { _dbFields, _dbPrimaryKey } = constructor;
    const insertableFields: Array<string> = this._updatableFields;

    let query = `INSERT INTO \`${constructor._dbTable}\` `;
    query += `(\`${insertableFields.map(field => _dbFields[field].name).join('`, `')}\`) VALUES `;
    query += `(${insertableFields.map(field => `$${field}`).join(', ')})`;

    const result = await db.conn.run(query, this._getUpdatableFieldsQueryObject(insertableFields));

    if (_dbPrimaryKey) {
      this[_dbPrimaryKey] = result.lastID;
    }
  }

  /**
   * UPDATEs the database row to reflect the object model
   *
   * @param db The database object
   */
  private async _update(): Promise<void> {
    const constructor = <typeof DbModel>this.constructor;

    constructor._verifyFields(true);

    const { _dbFields, _dbPrimaryKey } = constructor;
    const fields = Object.keys(_dbFields);
    const updateableFields: Array<string> = this._updatableFields;

    let query = `UPDATE \`${constructor._dbTable}\` SET `;
    query += updateableFields.map(field => {
      return `\`${_dbFields[field]}\` = :${field}`;
    }).join(', ');
    query += ` WHERE \`${_dbFields[_dbPrimaryKey]}\` = $${_dbPrimaryKey}`;

    await db.conn.run(query, this._getUpdatableFieldsQueryObject(updateableFields));
  }

  /**
   * Returns all rows in the table
   *
   * @param conditions A dictionary of conditions for the query
   */
  public static async selectAll(conditions: Dictionary<any> = null) {
    this._verifyFields();

    const whereClause: WhereClause = conditions && this._generateWhereClause(conditions);
    const retVal: Array<DbModel> = [];
    await db.conn.each(
      `SELECT * FROM \`${this._dbTable}\`${whereClause.sql ? ` WHERE ${whereClause.sql}` : ''}`,
      whereClause.params,
      (err: any, row: any) => {
        if (!err) {
          retVal.push(this._createThisFromRow(row));
        }
      }
    );

    return retVal;
  }

  /**
   * Returns single row search by ID
   *
   * @param db The database object
   * @param id ID of the row to find
   */
  public static selectById(id: (number | string)) {
    // this._verifyFields();
    // const primaryKeyField = this._dbFields[this._dbPrimaryKey].name;
    // return db.query(
    //   `SELECT * FROM \`${this._dbTable}\` WHERE \`${primaryKeyField}\`=:primaryKey LIMIT 1`,
    //   { primaryKey: id }
    // ).then(result => {
    //   let retVal = null;
    //   if (result && result.rows && result.rows.length) {
    //     retVal = this._createThisFromRow(result.rows[0]);
    //   }
    //   return retVal;
    // });
  }

  /**
   * Generates the WHERE clause for a query and the parameters object
   * to pass.
   *
   * @param conditions The conditions object
   */
  private static _generateWhereClause(conditions: Dictionary<any> = null): WhereClause {
    // { stationKey: 'KOUT', observationType: 'temperature', observationDate: { between: [ 1, 2 ] } }
    const retVal = {
      sql: '',
      params: {},
    };

    if (!conditions) {
      return retVal;
    }

    Object.keys(conditions).forEach(key => {
      const field: ColumnDescriptor = this._dbFields[key];
      if (field) {
        const whereCondition = this._generateWhereCondition(field, conditions[key]);
        retVal.sql = retVal.sql ? `${retVal.sql} AND ${whereCondition.sql}` : whereCondition.sql;
        retVal.params = { ...retVal.params, ...whereCondition.params };
      } else {
        throw new Error(`Unknown field "${key}" on "${this._dbTable}"`);
      }
    });

    return retVal;
  }

  private static _generateWhereCondition(field: ColumnDescriptor, condition: any): WhereClause {
    let retVal: WhereClause = {
      sql: '',
      params: {},
    };

    if (typeof condition === 'object') {
      // A passed array is 'IN'
      if (Array.isArray(condition)) {
        retVal.sql = `\`${field}\` IN (${
          condition.map((value: any, index: number) => {
            const paramName = `${this.name}${index}`;
            retVal.params[paramName] = value;
            return `\$${paramName}`;
          }).join(', ')
        }`;
      } else {
        // Only support for one operator per field for now
        const operator: string = Object.keys(condition)[0];
        const value = condition[operator];

        if (operator in WHERE_OPERATORS) {
          retVal = WHERE_OPERATORS[operator](field, value);
        } else {
          throw new Error(`Unsupported comparison operator "${operator}"`);
        }
      }
    } else {
      retVal = WHERE_OPERATORS.eq(field, condition);
    }

    return retVal;
  }

  /**
   * Instantiates the extended object and populates it with row
   * information returned from a query.
   *
   * @param row The database row information
   */
  private static _createThisFromRow(row: any) {
    const retVal = this.create();
    retVal.mysqlCopyFromRow(row);
    return retVal;
  }

  /**
   * Verifies that all fields on the extended object have been set correctly
   *
   * @param primaryKeyRequired Check that the primary key field has been set
   */
  private static _verifyFields(primaryKeyRequired = false) {
    if (!this._dbTable) {
      throw new Error('[DbModel] Table name is not set');
    }

    if (!this._dbFields) {
      throw new Error('[DbModel] Field map is not set');
    }

    if (primaryKeyRequired && !this._dbPrimaryKey) {
      throw new Error('[DbModel] Primary key is not set and required for that operation');
    }

    if (this._dbPrimaryKey && !this._dbFields[this._dbPrimaryKey]) {
      throw new Error(`[DbModel] Primary key "${this._dbPrimaryKey}" not found in ${this._dbTable}`);
    }
  }
}

interface DbModelPrototype {
  new(...args:Array<any>): DbModel;
}

/**
 * Class decorator to set the table name of an extended DbModel
 *
 * @param tableName The name of the database table
 */
export function tableName(tableName: string): Function {
  return function tableNameDecorator<T extends DbModelPrototype>(DbModelClass: T) {
    return class extends DbModelClass {
      private static _dbTable: string = tableName;
    }
  }
}

/**
 * Class decorator to set the table schema and mapping of columns to properties of
 * and extended DbModel
 *
 * @param tableSchemaObj A dictionary of class properties to column schema
 */
export function tableSchema(tableSchemaObj: Dictionary<ColumnDescriptor>): Function {
  return function fieldMapDecorator<T extends DbModelPrototype>(DbModelClass:T) {
    // See if there's a primary key in the field map
    let primaryKey: (string | undefined) = undefined;
    Object.keys(tableSchemaObj).find(key => {
      primaryKey = tableSchemaObj[key].primaryKey ? key : undefined;
      return !!primaryKey;
    });

    return class extends DbModelClass {
      private static _dbFields: Dictionary<ColumnDescriptor> = tableSchemaObj;
      private static _dbPrimaryKey: (string | undefined) = primaryKey;
    }
  }
}
