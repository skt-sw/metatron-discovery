/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Component, ElementRef, Injector, OnInit, Input, ViewChild, HostListener, EventEmitter, Output } from '@angular/core';
import { DatasetService } from '../service/dataset.service';
import { AbstractPopupComponent } from '../../../common/component/abstract-popup.component';
import { PopupService } from '../../../common/service/popup.service';
import { PreparationAlert } from '../../util/preparation-alert.util';
import { DatasetJdbc, DsType, RsType, ImportType, Field, SelectedInfo } from '../../../domain/data-preparation/dataset';
import { DataconnectionService } from '../../../dataconnection/service/dataconnection.service';
import { GridComponent } from '../../../common/component/grid/grid.component';
import { header, SlickGridHeader } from '../../../common/component/grid/grid.header';
import { GridOption } from '../../../common/component/grid/grid.option';
import { StringUtil } from '../../../common/util/string.util';
import * as $ from "jquery";
import { isNullOrUndefined } from "util";

@Component({
  selector: 'app-create-dataset-db-query',
  templateUrl: './create-dataset-db-query.component.html',
  providers: [DataconnectionService]
})
export class CreateDatasetDbQueryComponent extends AbstractPopupComponent implements OnInit  {

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Private Variables
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  @ViewChild(GridComponent)
  private gridComponent: GridComponent;
  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Protected Variables
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Public Variables
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  @Input()
  public datasetJdbc: DatasetJdbc;

  public isDatabaseListShow : boolean = false;  // Database list show/hide
  public isSchemaListShow: boolean = false;     // tables list show/hide
  public tableOrQuery: string = 'table';        // 테이블 or query 방식 Default is table

  public isQuerySuccess: boolean;               // 쿼리 성공 실패 여부
  public showQueryStatus: boolean = false;
  public queryErrorMsg: string = '';

  public databaseList: any[] = [];              // Database list (first selectBox)
  public schemaList: any[] = [];                // schema list (next selectBox)

  public clickable: boolean = false;            // is next btn clickable

  // 선택된 데이터베이스 (query)
  public selectedDatabaseQuery: string = '';

  public dbSearchText: string = '';
  public schemaSearchText: string = '';

  public flag: boolean = false;

  public clearGrid : boolean = false;

  public isTableEmpty: boolean = false;

  @Output()
  public typeEmitter = new EventEmitter<string>();

  // editor option
  public options: any = {
    maxLines: 20,
    printMargin: false,
    setAutoScrollEditorIntoView: true,
    enableBasicAutocompletion: true,
    enableSnippets: true,
    enableLiveAutocompletion: true
  };

  get filteredDbList() {
    let databaseList = this.databaseList;

    const isDbSearchTextEmpty = StringUtil.isNotEmpty(this.dbSearchText);

    // 검색어가 있다면
    if (isDbSearchTextEmpty) {
      databaseList = databaseList.filter((item) => {
        return item.name.toLowerCase().indexOf(this.dbSearchText.toLowerCase()) > -1;
      });
    }
    return databaseList;

  }

  get filteredSchemaList() {
    let schemaList = this.schemaList;

    const isSchemaSearchTextEmpty = StringUtil.isNotEmpty(this.schemaSearchText);

    // 검색어가 있다면
    if (isSchemaSearchTextEmpty) {
      schemaList = schemaList.filter((item) => {
        return item.name.toLowerCase().indexOf(this.schemaSearchText.toLowerCase()) > -1;
      });
    }
    return schemaList;

  }
  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Constructor
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  // 생성자
  constructor(private popupService: PopupService,
              private datasetService: DatasetService,
              private connectionService: DataconnectionService,
              protected elementRef: ElementRef,
              protected injector: Injector) {
    super(elementRef, injector);
  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Override Method
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  // Init
  public ngOnInit() {
    super.ngOnInit();

    this.getDatabases();

    // Only initialise selectedInfo when selectedInfo doesn't have value
    if (isNullOrUndefined(this.datasetJdbc.selectedInfo)) {
      this.datasetJdbc.selectedInfo = new SelectedInfo();
    }

    this.datasetJdbc.tableName = '';
    this.datasetJdbc.databaseName = '';
    this.datasetJdbc.queryStmt = '';
    this.datasetJdbc.dsType = DsType.IMPORTED;
    this.datasetJdbc.rsType = RsType.TABLE;
    this.datasetJdbc.importType = ImportType.DB;
  }

  // Destory
  public ngOnDestroy() {
    super.ngOnDestroy();
  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Public Method
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  public next() {

    // 선택된 테이블/query가 없다면
    if (!this.clickable) {
      return;
    }

    this.typeEmitter.emit('DB');
    this.popupService.notiPopup({
      name: 'create-dataset-name',
      data: null
    });
  }

  public prev() {
    this.popupService.notiPopup({
      name: 'create-db-select',
      data: null
    });
  }

  public close() {

    // Check if came from dataflow
    if (this.datasetService.dataflowId) {
      this.datasetService.dataflowId = undefined;
    }

    super.close();
    this.popupService.notiPopup({
      name: 'close-create',
      data: null
    });
  } // function - close

  /**
   * 데이터베이스 변경에 대한 이벤트 핸들러
   * @param event
   * @param database
   */
  public onChangeDatabase(event,database) {
    this.isDatabaseListShow = false;
    this.gridComponent.destroy();

    event.stopPropagation();
    this.datasetJdbc.databaseName = database.name;
    this.datasetJdbc.selectedInfo.database = database.name;

    this.datasetJdbc.selectedInfo.table = '';

    this.clickable = false;
    this.getTables(database.name);
    this.initSelectedCommand(this.filteredDbList);
  } // function - onChangeDatabase

  /**
   * 테이블 변경에 대한 이벤트 핸들러
   * @param event
   * @param data
   */
  public onChangeTable(event, data:any) {
    this.isSchemaListShow = false;
    event.stopPropagation();

    this.loadingShow();
    this.datasetJdbc.queryStmt = 'SELECT * FROM ' + this.datasetJdbc.databaseName + '.' + data.name;
    this.datasetJdbc.tableName = data.name;

    // Save table name -
    this.datasetJdbc.selectedInfo.table = data.name;

    let params = {connection : this.datasetJdbc.dataconnection.connection, database : this.datasetJdbc.databaseName, query : this.datasetJdbc.tableName, type : 'TABLE'};
    this.connectionService.getTableDetailWitoutId(params)
      .then((result) => {
        this.loadingHide();
        if (result.fields.length > 0 && result.data.length > 0) {

          const headers: header[] = this._getHeaders(result.fields);
          const rows: any[] = this._getRows(result.data);

          // Save grid info -
          this.datasetJdbc.selectedInfo.headers = headers;
          this.datasetJdbc.selectedInfo.rows = rows;

          this.clearGrid = false;
          this._drawGrid(headers, rows);
          this.clickable = true;

        } else {
          this.clearGrid = true;
          this.gridComponent.destroy();
        }

      })
      .catch((error) => {
        this.loadingHide();
        let prep_error = this.dataprepExceptionHandler(error);
        PreparationAlert.output(prep_error, this.translateService.instant(prep_error.message));

        this.clearGrid = true;
        this.gridComponent.destroy();
      });
    this.initSelectedCommand(this.filteredSchemaList);
  } // function - onChangeTable


  /** 데이터베이스 셀렉트 박스 show/hide */
  public showDatabaseList(event?) {
    event ? event.stopImmediatePropagation() : null;
    this.isDatabaseListShow = true;
    this.isSchemaListShow = false;
    this.dbSearchText = ''; //검색어 초기화
    setTimeout(() => $('.db-search').trigger('focus')); // focus on input

  } // function - showDatabaseList

  /** 특정 데이터 베이스 내 테이블 셀렉트 박스 show/hide */
  public showSchemaList(event) {
    event.stopImmediatePropagation();
    this.isSchemaListShow = true;
    this.isDatabaseListShow = false;
    this.schemaSearchText = ''; //검색어 초기화
    setTimeout(() => $('.schema-search').trigger('focus')); // focus on input

  } // function - showSchemaList

  /**
   * init table tab
   */
  public initTable() {
    this.datasetJdbc.tableName = '';
    this.datasetJdbc.databaseName = '';
    this.datasetJdbc.queryStmt = '';
    this.safelyDetectChanges();
  }

  /**
   * init Query tab
   */
  public initQuery() {
    this.datasetJdbc.tableName = '';
    this.selectedDatabaseQuery = '';
    this.datasetJdbc.queryStmt = '';
    this.showQueryStatus = false;
    this.safelyDetectChanges();
  }
  /**
   * Table or Query ?
   * @param method
   */
  public selectedMethod(method) {

    if (this.tableOrQuery !== method) {
      if( method==='table' ) {
        this.datasetJdbc.rsType = RsType.TABLE;
      } else {
        this.datasetJdbc.rsType = RsType.SQL;
      }
      this.tableOrQuery = method;

      if (this.gridComponent) {
        this.gridComponent.destroy(); // destroy grid
      }

      this.clickable = false; // prevent moving to next stage
      this.isDatabaseListShow = false;
      this.isSchemaListShow = false;
      this.initTable();
      this.initQuery();
      this.datasetJdbc.selectedInfo = new SelectedInfo();

    }

  } // function - selectedMethod

  /** 쿼리로 테이블 불러오기 */
  public runJdbcQuery() {
    if (this.datasetJdbc.queryStmt == null || this.datasetJdbc.queryStmt == '' || this.datasetJdbc.queryStmt == undefined) {
      return;
    }

    // console.info('runJdbcQuery', this.datasetJdbc);
    const param: any = {};
    param.connection = this.datasetJdbc.dataconnection.connection;
    param.hostname = this.datasetJdbc.dataconnection.connection.hostname;
    param.implementor = this.datasetJdbc.dataconnection.connection.implementor;
    param.username = this.datasetJdbc.dataconnection.connection.username;
    param.password = this.datasetJdbc.dataconnection.connection.password;
    param.port = this.datasetJdbc.dataconnection.connection.port;
    param.query = this.datasetJdbc.queryStmt;
    param.type = 'QUERY';

    // console.info('param', param);

    this.queryErrorMsg = '';
    if(this.gridComponent) {
      this.gridComponent.destroy(); // destroy grid
    }

    // Save query for -
    this.datasetJdbc.selectedInfo.query = this.datasetJdbc.queryStmt;

    // // 테이블 상세 조회
    this.datasetService.getTableDetailWitoutId(param)
      .then((result) => {
        this.loadingHide();
        // console.info('getTableDetailWitoutId', result);
        if (result.hasOwnProperty('errorMsg')) {
          this.showQueryStatus = true;
          this.isQuerySuccess = false;
          this.queryErrorMsg = result.errorMsg;
          this.clickable = false;
          this.gridComponent.destroy();
          return;
        }
        this.showQueryStatus = true;
        this.isQuerySuccess = true;

        const headers: header[] = this._getHeaders(result.fields);
        const rows = this._getRows(result.data);

        // Save grid info -
        this.datasetJdbc.selectedInfo.headers = headers;
        this.datasetJdbc.selectedInfo.rows = rows;

        this.clearGrid = false;
        this._drawGrid(headers,rows);
        this.clickable = true;

      })
      .catch((error) => {

        // show error alert when query fails ? Datasource doesn't
        // let prep_error = this.dataprepExceptionHandler(error);
        // PreparationAlert.output(prep_error, this.translateService.instant(prep_error.message));

        this.gridComponent.destroy(); // destroy grid
        this.clearGrid = true;
        this.showQueryStatus = true;
        this.isQuerySuccess = false;
        this.queryErrorMsg = error.details;
        this.clickable = false;
        //   // 쿼리가 실패했다면 error message 를 날리자
        this.loadingHide();
      });
  }

  public editorTextChange(param: string) {
    if(this.clickable) {
      this.clickable = !this.clickable;
    }
    if(param != this.datasetJdbc.queryStmt) {
      this.datasetJdbc.queryStmt = param;
    }
    this.safelyDetectChanges();
  }

  /**
   * Select box - navigate with keyboard
   * @param event 이벤트
   * @param currentList 현재 사용하는 리스트
   * @param method
   */
  public navigateWithKeyboardShortList(event, currentList, method) {

    // set scroll height
    let height = 25;

    // open select box when arrow up/ arrow down is pressed
    if(event.keyCode === 38 || event.keyCode === 40) {
      switch(method) {
        case 'db' :
          !this.isDatabaseListShow ? this.isDatabaseListShow = true: null;
          break;
        case 'schema' :
          !this.isSchemaListShow ? this.isSchemaListShow = true: null;
          break;
      }
    }

    // when there is no element in the list
    if(currentList.length === 0){
      return;
    }

    // this.commandList 에 마지막 인덱스
    let lastIndex = currentList.length-1;

    // command List 에서 selected 된 index 를 찾는다
    const idx = currentList.findIndex((command) => {
      if (command.selected) {
        return command;
      }
    });
    // when Arrow up is pressed
    if (event.keyCode === 38) {

      // 선택된게 없다
      if ( idx === -1) {

        // 리스트에 마지막 인덱스를 selected 로 바꾼다
        currentList[lastIndex].selected = true;

        // 스크롤을 마지막으로 보낸다
        $('.ddp-selectdown').scrollTop(lastIndex*height);

        // 리스트에서 가장 첫번쨰가 선택되어 있는데 arrow up 을 누르면 리스트에 마지막으로 보낸다
      } else if (idx === 0) {

        currentList[0].selected = false;
        currentList[lastIndex].selected = true;


        // 스크롤을 마지막으로 보낸다
        $('.ddp-selectdown').scrollTop(lastIndex*height);

      } else {
        currentList[idx].selected = false;
        currentList[idx-1].selected = true;
        $('.ddp-selectdown').scrollTop((idx-1)*height);
      }

      // when Arrow down is pressed
    } else if (event.keyCode === 40) {

      // 리스트에 첫번째 인텍스를 selected 로 바꾼다
      if ( idx === -1) {
        currentList[0].selected = true;

        // 리스트에서 가장 마지막이 선택되어 있는데 arrow down 을 누르면 다시 리스트 0번째로 이동한다
      }  else if (idx === lastIndex) {

        currentList[0].selected = true;
        currentList[lastIndex].selected = false;
        $('.ddp-selectdown').scrollTop(0);

      } else {
        currentList[idx].selected = false;
        currentList[idx+1].selected = true;
        $('.ddp-selectdown').scrollTop((idx+1)*height);

      }

    }

    // enter
    if (event.keyCode === 13) {

      // selected 된 index 를 찾는다
      const idx = currentList.findIndex((command) => {
        if (command.selected) {
          return command;
        }
      });

      // 선택된게 없는데 엔터를 눌렀을때
      if (idx === -1) {
        return;
      } else {
        switch(method) {
          case 'db' :
            this.onChangeDatabase(event,currentList[idx]);
            break;
          case 'schema' :
            this.onChangeTable(event, currentList[idx]);
            break;
        }
      }
      // 스크롤, command select 초기화
      this.initSelectedCommand(currentList);
    }
  }


  /**
   * list 에서 Mouseover 일때 Selected = true, mouseleave 일때 selected = false
   * @param event 이벤트
   * @param list
   * @param index
   */
  public listHover(event,list,index) {

    let tempList = [];
    switch(list) {
      case 'db':
        tempList = this.filteredDbList;
        break;
      case 'schema':
        tempList = this.filteredSchemaList;
        break;
    }

    if (!this.flag) {
      if (event.type === 'mouseover') {
        tempList[index].selected = true;

      } else if (event.type === 'mouseout') {
        this.initSelectedCommand(tempList);
      }
    }
  } // function - commandListHover


  /** change list selected -> false (초기화) */
  public initSelectedCommand(list) {
    list.forEach((item) => {
      return item.selected = false;
    })
  } // function - initSelectedCommand


  /** apply rule with enter key */
  @HostListener('document:keydown.enter', ['$event'])
  public onEnterKeydownHandler(event: KeyboardEvent) {
    // enter key only works when there is not popup or selectbox opened
    if(event.keyCode === 13) {
      if (!this.isSchemaListShow && !this.isSchemaListShow ) {
        this.next();
      }
    }
  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Protected Method
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Private Method
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  /**
   * 데이터베이스 목록 조회
   */
  private getDatabases() {
    this.loadingShow();

    if (!this.datasetJdbc.dataconnection.connection) {
      this.datasetJdbc.dcId = this.datasetJdbc.dataconnection.id;
      this.datasetJdbc.dataconnection = {connection : {
        hostname: this.datasetJdbc.dataconnection.hostname,
        implementor: this.datasetJdbc.dataconnection.implementor,
        password: this.datasetJdbc.dataconnection.password,
        port: this.datasetJdbc.dataconnection.port,
        url: this.datasetJdbc.dataconnection.url,
        username: this.datasetJdbc.dataconnection.username}
      };
    }


    this.loadingShow();
    this.connectionService.getDatabasesWithoutId(this.datasetJdbc.dataconnection)
      .then((data) => {
        this.loadingHide();
        if (data && data.databases) {
          for (let idx = 0, nMax = data.databases.length; idx < nMax; idx = idx + 1) {
            this.databaseList.push({ idx : idx, name : data.databases[idx], selected : false });
          }
        }

        // 다음 단계에서 다시 돌아왔다면 이미 선택된 정보를 다시 넣어줘야한다
        if ( (this.datasetJdbc.selectedInfo.rows && this.datasetJdbc.selectedInfo.headers) || this.datasetJdbc.selectedInfo.query) {

          // 탭 선택
          this.tableOrQuery = this.datasetJdbc.selectedInfo.query ? 'query' : 'table';

          if (this.tableOrQuery === 'table') {
            this.datasetJdbc.tableName = this.datasetJdbc.selectedInfo.table;
            this.datasetJdbc.databaseName = this.datasetJdbc.selectedInfo.database;
            this.clearGrid = false;
            this.getTables(this.datasetJdbc.databaseName);
          } else {
            this.datasetJdbc.queryStmt = this.datasetJdbc.selectedInfo.query;
          }
          this._drawGrid(this.datasetJdbc.selectedInfo.headers,this.datasetJdbc.selectedInfo.rows);

        } else {
          this.showDatabaseList();
        }

      })
      .catch((error) => {
        this.loadingHide();
        let prep_error = this.dataprepExceptionHandler(error);
        PreparationAlert.output(prep_error, this.translateService.instant(prep_error.message));
      });


  } // function - getDatabases

  /**
   * 특정 데이터 베이스 내 테이블 목록 조회
   * @param {string} schema
   */
  private getTables(schema:string) {
    this.loadingShow();

    this.schemaList = [];
    this.datasetJdbc.tableName = '';

    this.connectionService.getTablesWitoutId({connection : this.datasetJdbc.dataconnection.connection, database : schema})
      .then((data) => {
        this.loadingHide();
        if (data && data.tables.length > 0) {
          data.tables.forEach((item, index) => {
            this.schemaList.push({idx : index, name : item, selected : false});
          });

          if (this.datasetJdbc.selectedInfo.table) {
            this.datasetJdbc.tableName = this.datasetJdbc.selectedInfo.table;
          }
          this.isTableEmpty = false;
        } else {
          this.schemaList = [];
          this.datasetJdbc.tableName = '';
          this.datasetJdbc.selectedInfo.table = '';
          this.isTableEmpty = true;
        }
      })
      .catch((error) => {
        this.schemaList = [];
        this.loadingHide();
        let prep_error = this.dataprepExceptionHandler(error);
        PreparationAlert.output(prep_error, this.translateService.instant(prep_error.message));
      });

  } // function - getTables


  /**
   * Draw Grid
   * @param {header[]} headers
   * @param {any[]} rows
   * @private
   */
  private _drawGrid(headers: header[], rows : any[]) {
    // 그리드가 영역을 잡지 못해서 setTimeout으로 처리
    setTimeout(() => {
      this.gridComponent.create(headers, rows, new GridOption()
        .SyncColumnCellResize(true)
        .MultiColumnSort(true)
        .RowHeight(32)
        .NullCellStyleActivate(true)
        .build()
      )},400);
    this.clickable = true;
  }


  /**
   * Return Rows for grid
   * @param rows
   * @returns {any[]}
   * @private
   */
  private _getRows(rows) : any[] {
    let result = rows;
    if (result.length > 0 && !result[0].hasOwnProperty('id')) {
      result = rows.map((row: any, idx: number) => {
        row.id = idx;
        return row;
      });
    }
    return result;
  }


  /**
   * Returns headers for grid
   * @param headers
   * @returns {header[]}
   * @private
   */
  private _getHeaders(headers) : header[] {
    return headers.map(
      (field: Field) => {
        return new SlickGridHeader()
          .Id(field.name)
          .Name('<span style="padding-left:20px;"><em class="' + this.getFieldTypeIconClass(field.type === 'UNKNOWN' ? field.logicalType : field.type) + '"></em>' + field.name + '</span>')
          .Field(field.name)
          .Behavior('select')
          .Selectable(false)
          .CssClass('cell-selection')
          .Width(10 * (field.name.length) + 20)
          .MinWidth(100)
          .CannotTriggerInsert(true)
          .Resizable(true)
          .Unselectable(true)
          .Sortable(true)
          .build();
      }
    );
  }



}
