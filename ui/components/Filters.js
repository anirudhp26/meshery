import React, { useState, useEffect, useRef } from "react";
import { withStyles } from "@material-ui/core/styles";
import {
  NoSsr,
  TableCell,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Tooltip,
} from "@material-ui/core";
import { UnControlled as CodeMirror } from "react-codemirror2";
import DeleteIcon from "@material-ui/icons/Delete";
import UploadIcon from "@material-ui/icons/Publish";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import MUIDataTable from "mui-datatables";
import PromptComponent from "./PromptComponent";
import Moment from "react-moment";
import { withSnackbar } from "notistack";
import CloseIcon from "@material-ui/icons/Close";
import EditIcon from "@material-ui/icons/Edit";
import PlayArrowIcon from "@material-ui/icons/PlayArrow";
import { updateProgress } from "../lib/store";
import TableSortLabel from "@material-ui/core/TableSortLabel";
import dataFetch from "../lib/data-fetch";
import URLUploader from "./URLUploader";

const styles = (theme) => ({
  grid : {
    padding : theme.spacing(2),
  },
  tableHeader : {
    fontWeight : "bolder",
    fontSize : 18,
  },
});

function CustomToolbar(onClick, urlOnClick) {
  return function Toolbar() {
    return (
      <>
        <label htmlFor="upload-button">
          <input
            type="file"
            accept=".yaml, .yml, .json"
            hidden
            onChange={onClick}
            id="upload-button"
            name="upload-button"
          />
          <Tooltip title="Upload Filter">
            <IconButton aria-label="Upload" component="span">
              <UploadIcon />
            </IconButton>
          </Tooltip>
        </label>

        <URLUploader onSubmit={urlOnClick} />
      </>
    );
  };
}
function YAMLEditor({ filter, onClose, onSubmit }) {
  const [yaml, setYaml] = useState("");

  return (
    <Dialog onClose={onClose} aria-labelledby="filter-dialog-title" open fullWidth maxWidth="md">
      <DialogTitle id="filter-dialog-title">{filter.name}</DialogTitle>
      <Divider variant="fullWidth" light />
      <DialogContent>
        <CodeMirror
          value={filter.filter_file}
          options={{
            theme : "material",
            lineNumbers : true,
            lineWrapping : true,
            gutters : ["CodeMirror-lint-markers"],
            lint : true,
            mode : "text/x-yaml",
          }}
          onChange={(val) => setYaml(val)}
        />
      </DialogContent>
      <Divider variant="fullWidth" light />
      <DialogActions>
        <Tooltip title="Delete Filter">
          <IconButton
            aria-label="Delete"
            color="primary"
            onClick={() => onSubmit(yaml, filter.id, filter.name, "delete")}
          >
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </DialogActions>
    </Dialog>
  );
}

function MesheryFilters({
  updateProgress, enqueueSnackbar, closeSnackbar, user, classes
}) {
  const [page, setPage] = useState(0);
  const [search] = useState("");
  const [sortOrder] = useState("");
  const [count, setCount] = useState(0);
  const modalRef = useRef(null);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState([]);
  const [selectedRowData, setSelectedRowData] = useState(null);
  const DEPLOY_URL = '/api/filter/deploy';


  const ACTION_TYPES = {
    FETCH_FILTERS : {
      name : "FETCH_FILTERS",
      error_msg : "Failed to fetch filter",
    },
    DELETE_FILTERS : {
      name : "DELETE_FILTERS",
      error_msg : "Failed to delete filter file",
    },
    DEPLOY_FILTERS : {
      name : "DEPLOY_FILTERS",
      error_msg : "Failed to deploy filter file",
    },
    UPLOADFILTERS : {
      name : "UPLOAD_FILTERS",
      error_msg : "Failed to upload filter file",
    },
  };

  const searchTimeout = useRef(null);

  /**
   * fetch filters when the page loads
   */
  useEffect(() => {
    fetchFilters(page, pageSize, search, sortOrder);
  }, []);

  /**
   * fetchFilters constructs the queries based on the parameters given
   * and fetches the filters
   * @param {number} page current page
   * @param {number} pageSize items per page
   * @param {string} search search string
   * @param {string} sortOrder order of sort
   */

  const handleDeploy = (filter_file) => {
    dataFetch(
      DEPLOY_URL,
      { credentials : "include",
        method : "POST",
        body : filter_file, },() => {
        console.log("FilterFile Deploy API", `/api/filter/deploy`);
        updateProgress({ showProgress : false })
      },
      handleError(ACTION_TYPES.DEPLOY_FILTERS)
    );
  };

  function fetchFilters(page, pageSize, search, sortOrder) {
    if (!search) search = "";
    if (!sortOrder) sortOrder = "";

    const query = `?page=${page}&page_size=${pageSize}&search=${encodeURIComponent(search)}&order=${encodeURIComponent(
      sortOrder
    )}`;

    updateProgress({ showProgress : true });

    dataFetch(
      `/api/filter${query}`,
      { credentials : "include", },
      (result) => {
        console.log("FilterFile API", `/api/filter${query}`);
        updateProgress({ showProgress : false });
        if (result) {
          setFilters(result.filters || []);
          setPage(result.page || 0);
          setPageSize(result.page_size || 0);
          setCount(result.total_count || 0);
        }
      },
      // handleError
      handleError(ACTION_TYPES.FETCH_FILTERS)
    );
  }

  // function handleError(error) {
  const handleError = (action) => (error) => {
    updateProgress({ showProgress : false });

    enqueueSnackbar(`${action.error_msg}: ${error}`, {
      variant : "error",
      action : function Action(key) {
        return (
          <IconButton key="close" aria-label="Close" color="inherit" onClick={() => closeSnackbar(key)}>
            <CloseIcon />
          </IconButton>
        );
      },
      autoHideDuration : 8000,
    });
  };

  function resetSelectedRowData() {
    return () => {
      setSelectedRowData(null);
    };
  }

  function handleSubmit(data, id, name, type) {
    updateProgress({ showProgress : true });
    if (type === "delete") {
      dataFetch(
        `/api/filter/${id}`,
        { credentials : "include",
          method : "DELETE", },
        () => {
          console.log("FilterFile API", `/api/filter/${id}`);
          updateProgress({ showProgress : false });
          fetchFilters(page, pageSize, search, sortOrder);
          resetSelectedRowData()();
        },
        // handleError
        handleError(ACTION_TYPES.DELETE_FILTERS)
      );
    }

    if (type === "upload") {
      dataFetch(
        `/api/filter`,
        { credentials : "include",
          method : "POST",
          body : JSON.stringify({ filter_data : { filter_file : data }, save : true }), },
        () => {
          console.log("FilterFile API", `/api/filter`);
          updateProgress({ showProgress : false });
          fetchFilters(page, pageSize, search, sortOrder);
        },
        // handleError
        handleError(ACTION_TYPES.UPLOAD_FILTERS)
      );
    }
  }

  function uploadHandler(ev) {
    if (!ev.target.files?.length) return;

    const file = ev.target.files[0];

    // Create a reader
    const reader = new FileReader();
    reader.addEventListener("load", (event) => {
      handleSubmit(event.target.result, "", file?.name || "meshery_" + Math.floor(Math.random() * 100), "upload");
    });
    reader.readAsText(file);
  }
  function urlUploadHandler(link) {
    handleSubmit(link, "", "meshery_" + Math.floor(Math.random() * 100), "upload");
    console.log(link, "valid");
  }
  const columns = [
    {
      name : "name",
      label : "Filter Name",
      options : {
        filter : false,
        sort : true,
        searchable : true,
        customHeadRender : function CustomHead({ index, ...column }, sortColumn) {
          return (
            <TableCell key={index} onClick={() => sortColumn(index)}>
              <TableSortLabel active={column.sortDirection != null} direction={column.sortDirection || "asc"}>
                <b>{column.label}</b>
              </TableSortLabel>
            </TableCell>
          );
        },
      },
    },
    {
      name : "created_at",
      label : "Upload Timestamp",
      options : {
        filter : false,
        sort : true,
        searchable : true,
        customHeadRender : function CustomHead({ index, ...column }, sortColumn) {
          return (
            <TableCell key={index} onClick={() => sortColumn(index)}>
              <TableSortLabel active={column.sortDirection != null} direction={column.sortDirection || "asc"}>
                <b>{column.label}</b>
              </TableSortLabel>
            </TableCell>
          );
        },
        customBodyRender : function CustomBody(value) {
          return <Moment format="LLLL">{value}</Moment>;
        },
      },
    },
    {
      name : "updated_at",
      label : "Update Timestamp",
      options : {
        filter : false,
        sort : true,
        searchable : true,
        customHeadRender : function CustomHead({ index, ...column }, sortColumn) {
          return (
            <TableCell key={index} onClick={() => sortColumn(index)}>
              <TableSortLabel active={column.sortDirection != null} direction={column.sortDirection || "asc"}>
                <b>{column.label}</b>
              </TableSortLabel>
            </TableCell>
          );
        },
        customBodyRender : function CustomBody(value) {
          return <Moment format="LLLL">{value}</Moment>;
        },
      },
    },
    {
      name : "Actions",
      options : {
        filter : false,
        sort : false,
        searchable : false,
        customHeadRender : function CustomHead({ index, ...column }) {
          return (
            <TableCell key={index}>
              <b>{column.label}</b>
            </TableCell>
          );
        },
        customBodyRender : function CustomBody(_, tableMeta) {
          const rowData = filters[tableMeta.rowIndex];
          return (
            <>
              <IconButton>
                <EditIcon
                  title="Config"
                  aria-label="config"
                  color="inherit"
                  onClick={() => setSelectedRowData(filters[tableMeta.rowIndex])}
                />
              </IconButton>
              <IconButton>
                <PlayArrowIcon
                  title="Deploy"
                  aria-label="deploy"
                  color="inherit"
                  onClick={() => handleDeploy(rowData.filter_file)} //deploy endpoint to be called here
                />
              </IconButton>
            </>
          );
        },
      },
    },
  ];

  columns.forEach((column, idx) => {
    if (column.name === sortOrder.split(" ")[0]) {
      columns[idx].options.sortDirection = sortOrder.split(" ")[1];
    }
  });

  async function showmodal() {
    let response = await modalRef.current.show({ title : "Delete Filter?",

      subtitle : "Are you sure you want to delete this filter?",

      options : ["yes", "no"], })
    return response;
  }

  function deleteFilter(id) {
    dataFetch(
      `/api/filter/${id}`,
      {
        method : "DELETE",
        credentials : "include",
      },
      () => {
        updateProgress({ showProgress : false });

        enqueueSnackbar("Filter Successfully Deleted!", {
          variant : "success",
          autoHideDuration : 2000,
          action : function Action(key) {
            return (
              <IconButton key="close" aria-label="Close" color="inherit" onClick={() => closeSnackbar(key)}>
                <CloseIcon />
              </IconButton>
            );
          },
        });

        fetchFilters(page, pageSize, search, sortOrder);
      },
      handleError("Failed To Delete Filter")
    );
  }

  const options = {
    filter : false,
    sort : !(user && user.user_id === "meshery"),
    search : !(user && user.user_id === "meshery"),
    filterType : "textField",
    responsive : "scrollFullHeight",
    resizableColumns : true,
    serverSide : true,
    count,
    rowsPerPage : pageSize,
    rowsPerPageOptions : [10, 20, 25],
    fixedHeader : true,
    page,
    print : false,
    download : false,
    customToolbar : CustomToolbar(uploadHandler, urlUploadHandler),

    onRowsDelete : async function handleDelete(row) {
      let response  = await showmodal()
      console.log(response)
      if (response === "yes") {
        const fid = Object.keys(row.lookup).map((idx) => filters[idx]?.id);
        fid.forEach((fid) => deleteFilter(fid));
      }
      if (response === "no")
        fetchFilters(page, pageSize, search, sortOrder);
    },

    onTableChange : (action, tableState) => {
      const sortInfo = tableState.announceText ? tableState.announceText.split(" : ") : [];
      let order = "";
      if (tableState.activeColumn) {
        order = `${columns[tableState.activeColumn].name} desc`;
      }

      switch (action) {
        case "changePage":
          fetchFilters(tableState.page, pageSize, search, sortOrder);
          break;
        case "changeRowsPerPage":
          fetchFilters(page, tableState.rowsPerPage, search, sortOrder);
          break;
        case "search":
          if (searchTimeout.current) {
            clearTimeout(searchTimeout.current);
          }
          searchTimeout.current = setTimeout(() => {
            if (search !== tableState.searchText) {
              fetchFilters(page, pageSize, tableState.searchText !== null ? tableState.searchText : "", sortOrder);
            }
          }, 500);
          break;
        case "sort":
          if (sortInfo.length == 2) {
            if (sortInfo[1] === "ascending") {
              order = `${columns[tableState.activeColumn].name} asc`;
            } else {
              order = `${columns[tableState.activeColumn].name} desc`;
            }
          }
          if (order !== sortOrder) {
            fetchFilters(page, pageSize, search, order);
          }
          break;
      }
    },
  };

  return (
    <NoSsr>
      {selectedRowData && Object.keys(selectedRowData).length > 0 && (
        <YAMLEditor filter={selectedRowData} onClose={resetSelectedRowData()} onSubmit={handleSubmit} />
      )}
      <MUIDataTable
        title={<div className={classes.tableHeader}>Filters</div>}
        data={filters}
        columns={columns}
        // @ts-ignore
        options={options}
      />
      <PromptComponent ref={modalRef} />
    </NoSsr>
  );
}

const mapDispatchToProps = (dispatch) => ({ updateProgress : bindActionCreators(updateProgress, dispatch) });

const mapStateToProps = (state) => {
  return { user : state.get("user")?.toObject() };
};

// @ts-ignore
export default withStyles(styles)(connect(mapStateToProps, mapDispatchToProps)(withSnackbar(MesheryFilters)));