/*
 * This script contains several components
 *
 * Lower_Left_Content
 *    - Values_Plot
 *    - Sig_Info
 *    - Sig_Heatmap
 *    - Cell_Info
 *    - Selection_Info (for pools or multiple cells/pools)
 *
 */

function Lower_Left_Content()
{
    this.dom_node = document.getElementById('lower-left-content')
    this.children = []
    this.values_plot = {}
    this.sig_info = {}
    this.sig_heatmap = {}
    this.cell = {}
    this.nav = {
        'values': $(this.dom_node).find('#ValuesButton'),
        'sig_info': $(this.dom_node).find('#SigInfoButton'),
        'sig_heatmap': $(this.dom_node).find('#HeatmapButton'),
        'cell_info': $(this.dom_node).find('#CellButton'),
        'selection_info': $(this.dom_node).find('#SelectionButton'),
    }
}

Lower_Left_Content.prototype.init = function()
{
    var sig_info = new Sig_Info()
    this.children.push(sig_info)
    this.sig_info = sig_info

    var sig_info_promise = sig_info.init();

    var values_plot = new Values_Plot()
    this.children.push(values_plot)
    this.values_plot = values_plot

    var values_plot_promise = values_plot.init();

    var sig_heatmap = new Sig_Heatmap()
    this.children.push(sig_heatmap)
    this.sig_heatmap = sig_heatmap

    var sig_heatmap_promise = sig_heatmap.init();

    var cell_info = new Cell_Info()
    this.children.push(cell_info)
    this.cell_info = cell_info

    var cell_info_promise = cell_info.init();

    var selection_info = new Selection_Info()
    this.children.push(selection_info)
    this.selection_info = selection_info

    var selection_info_promise = selection_info.init();

    var self = this;
    this.nav['sig_heatmap'].on('shown.bs.tab', function()
    {
        if(self.sig_heatmap.needs_resize){
            self.sig_heatmap.resize();
        }
        if(self.sig_heatmap.needs_plot){
            self.sig_heatmap.drawHeat()
        }
    })
    this.nav['values'].on('shown.bs.tab', function()
    {
        // Need to delay resize because it doesn't work
        // if the window is hidden
        if(self.values_plot.needs_resize){
            self.values_plot.resize()
        }
        if(self.values_plot.needs_plot){
            self.values_plot.plot()
        }
    })

    this.setLoadingStatus = createLoadingFunction(
        document.getElementById("lower-left-content")
    );

    $(this.dom_node).find('#download-cells-button')
        .on('click', self.exportSelectedCells)

    return $.when(sig_info_promise, values_plot_promise,
        sig_heatmap_promise, cell_info_promise,
        selection_info_promise);
}

Lower_Left_Content.prototype.update = function(updates)
{
    var self = this;

    // Updates passed to children components
    var child_promises = []
    _.each(self.children, function(child){
        child_promises.push(child.update(updates))
    });

    if('plotted_item_type' in updates){

        if( updates['plotted_item_type'] !== 'signature-gene'){
            self.nav['values'].click()
        }

        var item_type = get_global_status('plotted_item_type')
        // Modify which nav pills are shown
        if(item_type === 'signature' || item_type === 'signature-gene'){
            $(this.nav['sig_info']).show()
            $(this.nav['sig_heatmap']).show()
        } else {
            $(this.nav['sig_info']).hide()
            $(this.nav['sig_heatmap']).hide()
        }
    }

    if('selection_type' in updates){

        var SELECTION_IS_CELL = updates['selection_type'] === 'cell'
        var SELECTION_IS_CELLS = (
            updates['selection_type'] === 'cells' ||
            updates['selection_type'] === 'pool' ||
            updates['selection_type'] === 'pools'
        )

        // Show or hide 'Cell'
        if(SELECTION_IS_CELL){
            $(this.nav['cell_info']).show();
        } else {
            $(this.nav['cell_info']).hide();
        }

        // Show or hide 'Selection'
        if (SELECTION_IS_CELLS) {
            $(this.nav['selection_info']).show();
        } else {
            $(this.nav['selection_info']).hide();
        }

        // Determine navigation
        if (SELECTION_IS_CELL){
            $(this.nav['cell_info']).click();

        } else if(!SELECTION_IS_CELL && $(this.nav['cell_info']).hasClass('active')) {
            $(this.nav['values']).click();

        } else if(!SELECTION_IS_CELLS &&
            $(this.nav['selection_info']).hasClass('active')) {

            $(this.nav['values']).click();
        }

    }

    return $.when.apply($, child_promises)
}

Lower_Left_Content.prototype.hover_cells = function()
{
}


Lower_Left_Content.prototype._resize = function(){
    if($(this.nav['values']).hasClass('active')) {
        this.values_plot.resize()
    } else {
        this.values_plot.needs_resize = true
    }

    if($(this.nav['sig_heatmap']).hasClass('active')) {
        this.sig_heatmap.resize()
    } else {
        this.sig_heatmap.needs_resize = true
    }
}

Lower_Left_Content.prototype.resize = _.debounce(Lower_Left_Content.prototype._resize, 300)

function Values_Plot()
{
    this.dom_node = document.getElementById("value-plot");
    this.title = $(this.dom_node).find('#values-title').get(0);
    this.chart = $(this.dom_node).find('#dist-div').get(0);
    this.needs_resize = false
    this.needs_plot = false
}

Values_Plot.prototype.init = function()
{
}

Values_Plot.prototype.update = function(updates)
{
    var item_type = get_global_status('plotted_item_type')
    var item = get_global_status('plotted_item')

    if(!(
        'plotted_item' in updates ||
        'selected_cell' in updates ||
        'selection_type' in updates
    )){
        return;
    }

    if(item_type === 'gene' || item_type === 'signature-gene') {
        var urllink = "http://www.genecards.org/cgi-bin/carddisp.pl?gene=" + item;
        $(this.title).html(
            "<a href=" + urllink + " target='_blank'>" + item + "</a>"
        )
    } else {
        $(this.title).html(item)
    }

    if($(this.dom_node).hasClass('active')){
        this.plot()
    } else {
        this.needs_plot = true;
    }
}

Values_Plot.prototype.plot = function()
{
    var plotted_values_object = get_global_data('plotted_values')

    if(get_global_status('selection_type') === 'cells' ||
        get_global_status('selection_type') === 'pools'){

        var selected_cells = get_global_status('selected_cell')
        var selection_name = get_global_status('selection_name')
        var selected_values = _.values(_.pick(plotted_values_object, selected_cells))
        var remainder_values = _.values(_.omit(plotted_values_object, selected_cells))
        drawDistChartSelection(this.chart, selected_values, remainder_values, selection_name)
    } else {
        var plotted_values = _.values(plotted_values_object)
        drawDistChart(this.chart, plotted_values)
    }

    this.needs_plot = false
}

Values_Plot.prototype.resize = function()
{
    Plotly.Plots.resize(this.chart)
    this.needs_resize = false
}

/*
Values_Plot.prototype.addCellInfo = function() {

    // Need to create it if it isn't there
    var self = this;

    var cellinfo_div = $(self.dom_node).find('#cell-dist-div')
    cellinfo_div.show()

    if (self.CellInfo == null) {
        self.CellInfo = new Cell_Info("gene");
    }

    var gene_key = get_global_status('plotted_item'); // assume it's a gene
    var cells = get_global_status("selected_cells");

    // plotted heatmap is based on sig_key
    // check if we are already showing the right heatmap and don't regenerate
    var need_plot = false;

    if (self.plotted_cellinfo['gene_key'] !== gene_key){
        self.plotted_cellinfo['gene_key'] = gene_key
        need_plot = true;
    }

    if (self.plotted_cellinfo['cells'] !== cells) {
        self.plotted_cellinfo['cells'] = cells;
        need_plot = true;
    }

    if(!need_plot){
        return $.when(true);
    }

    cellinfo_div.addClass('loading')

    self.CellInfo.update()

    cellinfo_div.removeClass("loading");

}
*/


function Sig_Info()
{
    this.dom_node = document.getElementById("sig-info-default");
    this.title = $(this.dom_node).find('#data-analysis-title');
    this.source = $(this.dom_node).find('#sig-source');
    this.content = $(this.dom_node).find('#sig-table-wrapper');
    this.bound_sig = ""
}

Sig_Info.prototype.init = function()
{
    var dt = $(this.content).find('#sig-info-table')

    dt.DataTable( {
        columns: [
            {
                'title': 'Gene',
                'render': function(data)
                {
                    return '<a href="javascript:void(0);" onclick="_setSignatureGene(\'' + data + '\')">' + data + '</a>';
                }
            },
            {
                'title': 'Info',
                'render': function(data)
                {
                    return "<a href=http://www.genecards.org/cgi-bin/carddisp.pl?gene=" + data + " target='_blank'>&lt;genecards&gt;</a>";
                }
            },
            {'title': 'Sign', 'className': 'dt-center'},
            {
                'title': 'Score',
                'className': 'dt-center',
				'render': $.fn.dataTable.render.number(',', '.', 2)
            },
        ],
        'paging': false,
        'info': true,
        'scrollY': '15vh',
        'scrollCollapse': true,
        'order': [[3, 'desc']],
    })

}

Sig_Info.prototype.update = function(updates)
{

    var sig_info = get_global_data('sig_info');
    if(_.isEmpty(sig_info) || sig_info.name === this.bound_sig || sig_info.isMeta)
    {
        return;
    }

    this.bound_sig = sig_info.name

    $(this.title).text(sig_info.name)

    // cut down the sig-info source
    var source = sig_info.source

    if(source.lastIndexOf('/') !== -1){
        source = source.slice(source.lastIndexOf('/')+1)
    }

    if(source.length > 30){
        source = source.slice(0, 27) + '...';
    }


    $(this.source).text(source);

    // Render the gene table

    var dt = $(this.content).find('#sig-info-table')

    var sign;
    var dataSet = _.map(sig_info.sigDict, function (value, key){
        if(value > 0){
            sign = '+'
        } else {
            sign = '-'
        }
        return [key, key, sign, sig_info.geneImportance[key]];
    })

    dt.DataTable().clear()
        .rows.add(dataSet)
        .draw()
}

// Used when clicking on the gene namesin the signature-info table
function _setSignatureGene(gene){
    var update = {
        'plotted_item': gene,
        'plotted_item_type': 'signature-gene',
    }

    set_global_status(update)

}

function Sig_Heatmap()
{
    this.dom_node = document.getElementById('sig-info-cluster')
    this.heatmap = null
    this.plotted_signature = ""
    this.needs_resize = false
    this.needs_plot = true
}

Sig_Heatmap.prototype.init = function()
{
}

Sig_Heatmap.prototype.update = function(updates)
{
    var needs_update_sig = ('plotted_item' in updates) &&
        (get_global_status('plotted_item_type') === 'signature')

    var needs_update_cluster_var = 'cluster_var' in updates

    // Or else we'll update for signature-gene
    if(needs_update_sig){
        this.plotted_signature = get_global_status("plotted_item")
    }

    var needs_update = needs_update_sig || needs_update_cluster_var

    if(needs_update){
        if($(this.dom_node).hasClass('active')) {
            this.drawHeat()
            console.log("update here")
        } else {
            this.needs_plot = true;
        }
    }

}

Sig_Heatmap.prototype.initHeat = function(){
    var self = this;
    var heatmap_div = $(self.dom_node).find('#heatmap-div')
    self.heatmap_width = heatmap_div.parent().parent().width();
    var heatmap_height = heatmap_div.parent().parent().height()-40;

    // YANAY: change HeatMap method and on click method
    //self.heatmap = new HeatMap('#heatmap-div', heatmap_width, heatmap_height);

    


    // self.heatmap.click = function(gene, index, value){
    //     _setSignatureGene(gene);
    // }
}

Sig_Heatmap.prototype.drawHeat = function(){

    // Need to create it if it isn't there
    var self = this;

    var heatmap_div = $(self.dom_node).find('#heatmap-div')

    
    


    // if( heatmap_div.children('svg').length === 0)
    // {
    //     self.initHeat()
    // }

    var sig_key = this.plotted_signature // kept current by 'update' method
    var sig_info = get_global_data('sig_info');

    heatmap_div.addClass('loading')

    return $.when(
        api.signature.expression(sig_key))
        .then(function(sig_expression){


            //Construct data matrix
            // TODO: sort genes

            var dataMat = sig_expression.data;
            var gene_labels = sig_expression.gene_labels;
            var sample_labels = sig_expression.sample_labels;
            var clusters = get_global_data('clusters')

            var gene_signs = gene_labels.map(function(e){
                return sig_info.sigDict[e]
            });

            //var assignments = sample_labels.map(sample => clusters[sample]);

            //self.heatmap.setData(dataMat,
            //    assignments,
            //    gene_labels,
            //    gene_signs,
            //    sample_labels);

            self.needs_plot = false

            // yanay morpheus
            var json = {}
            json["rows"] = dataMat.length
            json["columns"] = dataMat[0].length
            json["seriesNames"] =  ["foo"]

            json["seriesArrays"] = [dataMat]
            json["seriesDataTypes"] = ["Float32"]


            json["rowMetadataModel"] = {"vectors":[{"name":"gene", "array":gene_labels}]}
            console.log("here draw")
            $('#heatmap-div').children().remove()

            new morpheus.HeatMap({
                el: heatmap_div,
                dataset: morpheus.Dataset.fromJSON(json),
                width: self.heatmap_width * 2,
	        });

        }).always(function() {
            heatmap_div.removeClass('loading');
        });
}

Sig_Heatmap.prototype.resize = function()
{
    var heatmap_div = $(this.dom_node).find('#heatmap-div')
    
    // fix this line
    
}

function Cell_Info()
{
    this.dom_node = document.getElementById('selected-cell-info')
}

Cell_Info.prototype.init = function()
{
    this.cell_id_span = $(this.dom_node).find('#cell-id-span')
    this.cell_info_table = $(this.dom_node).find('#cell-info-table')
}

Cell_Info.prototype.update = function(updates)
{
    var self = this;
    if(!('selected_cell' in updates)){
        return
    }

    if(get_global_status('selection_type') !== 'cell'){
        return
    }

    var selected_cell = updates['selected_cell'][0]

    return api.cell.meta(selected_cell).then(result => {
        self.cell_id_span.text(selected_cell)

        // Rebuild meta-data table
        self.cell_info_table.empty()
        $.each(result, function(property, value){
            var row = $(document.createElement('tr'))
            var prop = $(document.createElement('td'))
            var val = $(document.createElement('td'))
            prop.text(property+':');

            var val_string = _formatNum(value)

            val.text(val_string);
            row.append(prop)
            row.append(val)
            self.cell_info_table.append(row)
        })
    })
}

function Selection_Info()
{
    this.dom_node = document.getElementById('selection-info')
}

Selection_Info.prototype.init = function()
{
    this.cell_count_span = $(this.dom_node).find('#selected-cell-count-span')
    this.selection_info_table = $(this.dom_node).find('#selection-info-table')
    this.selection_info_table_meta = $(this.dom_node).find('#selection-info-table-meta')
}

Selection_Info.prototype.update = function(updates)
{
    var self = this;
    if(!('selected_cell' in updates)){
        return
    }

    if(
        get_global_status('selection_type') !== 'cells' &&
        get_global_status('selection_type') !== 'pool' &&
        get_global_status('selection_type') !== 'pools'
    ){
        return
    }

    var selected_cells = updates['selected_cell']
    self.cell_count_span.text(selected_cells.length)

    return api.cells.meta(selected_cells).then(result => {

        // Rebuild meta-data table
        self.selection_info_table.children('tbody').empty()
        _.each(result.numeric, function(value, property){
            var row = $(document.createElement('tr'))
            var prop = $(document.createElement('td'))
            var valmin = $(document.createElement('td'))
            var valmed = $(document.createElement('td'))
            var valmax = $(document.createElement('td'))

            prop.text(property+':');

            // valmin.text(value['Min'].toFixed(1));
            // valmed.text(value['Median'].toFixed(1));
            // valmax.text(value['Max'].toFixed(1));
            valmin.text(_formatNum(value['Min']));
            valmed.text(_formatNum(value['Median']));
            valmax.text(_formatNum(value['Max']));

            row.append(prop)
            row.append(valmin)
            row.append(valmed)
            row.append(valmax)

            self.selection_info_table.children('tbody').append(row)
        })

        self.selection_info_table_meta.children('tbody').empty()
        _.each(result.factor, function(value, property){

            // Header row
            var row = $(document.createElement('tr'))
            var prop = $(document.createElement('td'))
            var empty = $(document.createElement('td'))
            prop.text(property+':');
            row.append(prop)
            row.append(empty)
            self.selection_info_table_meta.children('tbody').append(row)

            // Row for each factor level
            _.each(value, function(percent, level){
                var row = $(document.createElement('tr'))
                var prop = $(document.createElement('td'))
                var value = $(document.createElement('td'))
                prop.text(level);
                prop.css('font-weight', 'normal')
                value.text(percent.toFixed(1)+'%');

                row.append(prop)
                row.append(value)
                self.selection_info_table_meta.children('tbody').append(row)
            })
        })
    })
}


function _formatNum(value){

    if($.isNumeric(value)){

        if(value === 0){ return "0"; }

        if((Math.abs(value) < 1e-3) ||
            (Math.abs(value) > 1e6) ){
            return value.toExponential(3);
        } else {
            return value.toString();
        }

    } else {
        return value.toString();
    }
}

/*

function Cell_Info()
{
    this.dom_node = document.getElementById("sig-info-cell")

    this.cell_info = null
    this.plotted_cellinfo = {
        'sig_key': '',
        'cells': [],
    }

    this.CellInfo = null;

}

Cell_Info.prototype.init = function()
{

    $(self.dom_node).find("#CellInfoButton").on('click', function()
    {
        self.addCellInfo()
    });
}

Cell_Info.prototype.update = function()
{
    if (this.sig_info_cell.hasClass("active")) {
        this.addCellInfo();
    }
}

Cell_Info.prototype.addCellInfo = function(){

    // Need to create it if it isn't there
    var self = this;



    var cellinfo_div = $(self.dom_node).find('#cell-dist-div')
    cellinfo_div.show()

    if (self.CellInfo == null) {
        self.CellInfo = new Cell_Info("signature");
    }

    var sig_key = get_global_status('plotted_item'); // assume it's a signature
    var cells = get_global_status("selected_cells");

    // plotted heatmap is based on sig_key
    // check if we are already showing the right heatmap and don't regenerate
    var need_plot = false;

    if (self.plotted_cellinfo['sig_key'] !== sig_key){
        self.plotted_cellinfo['sig_key'] = sig_key
        need_plot = true;
    }

    if (self.plotted_cellinfo['cells'] !== cells) {
        self.plotted_cellinfo['cells'] = cells;
        need_plot = true;
    }

    if(!need_plot){
        return $.when(true);
    }


    cellinfo_div.addClass('loading')

    self.CellInfo.update()

    cellinfo_div.removeClass("loading");

}
*/



/*
function Cell_Info(data_type)
{
    if (data_type == "signature") {
	       this.dom_node = document.getElementById("sig-info");
    } else if (data_type == "meta") {
	       this.dom_node = document.getElementById("meta-info");
    } else if (data_type == "gene") {
	       this.dom_node = document.getElementById("gene-info");
    }

    this.data_type = data_type;
    this.title = $(this.dom_node).find("#cell-analysis-title");
    this.source = $(this.dom_node).find('#cell-source');
    this.chart = $(this.dom_node).find('#cell-dist-div').get(0);
    this.bound_cell = ""
    this.cell_table = $(this.dom_node).find("#cell-info-table");

    var celldt = this.cell_table;

    celldt.DataTable( {
        columns: [
            { 'title': 'Cell' },
            {'title': 'Value', 'className': 'dt-center'}],
        'paging': false,
        'info': true,
        'scrollY': '15vh',
        'scrollCollapse': true,
    })

}

Cell_Info.prototype.init = function()
{

}

Cell_Info.prototype.update = function()
{

    var self = this;
    if (this.data_type == "signature") {

	var name = get_global_data('sig_info').name;

    } else if (this.data_type == "meta") {

	var name = get_global_status('plotted_item')

    } else if (this.data_type == "gene") {

	var name = get_global_status('plotted_item')

    }

    var item_type = get_global_status('plotted_item_type')
    var cells = get_global_status('selected_cells')

    if (Object.keys(cells).length > 1) {
	       this.bound_cell = "Selected Subset";
    } else {
	       this.bound_cell = cells[0]
    }

    $(this.title).text(name)
    $(this.source).text(this.bound_cell);

    var exp = get_global_data('plotted_values')

    var poolstatus = get_global_status("pooled")

    f_exp = []

    if (poolstatus && (this.data_type == "meta" || this.data_type == "gene")) {
    	var subset = [];
    	exp = Object.keys(exp).forEach(function(k) {
    	    if (cells.indexOf(k) > -1) {
    		          subset.push(k);
    	    }
    	});

        vals_promise = api.pool.values(subset, self.data_type, name);
        cellname_promise = api.pool.cells(subset);

    	return $.when(vals_promise, cellname_promise)
                    .then(function(vs, cell_subset) {


            if (vs == "[]") {
                alert("Not a cell property! Please choose another metadata item")
            }

    	    drawDistChart(self.chart, vs, "Values")

            exp_cells_dict = cell_subset.map(function(e, i) {
                return [e, vs[i]]
            });

            var dt = self.cell_table;

            dt.DataTable().clear()
                .rows.add(exp_cells_dict)
                .draw();

        });



    } else {
    	exp = Object.keys(exp).forEach(function(k) {
    	    if (cells.indexOf(k) > -1) {
    		f_exp.push(exp[k]);
    	   }
    	})

        drawDistChart(this.chart, f_exp, 'Values')

        exp_cells_dict = cells.map(function(e, i) {
            return [e, f_exp[i]]
        });

        var dt = this.cell_table;

        dt.DataTable().clear()
            .rows.add(exp_cells_dict)
            .draw()

    }
}
*/

function drawDistChart(node, values) {

    var isFactor = (typeof(values[0]) === "string") &&
                   (values[0] !== "NA")

    var data = []

    if (!isFactor) {
        var binmin = _.min(values)
        var binmax = _.max(values) + 1e-4 // end is not inclusive so need buffer

        data.push({
            type: 'histogram',
            x: values,
            autobinx: false,
            xbins: {
                start: binmin,
                end: binmax,
                size: (binmax-binmin)/40,
            },
        })
    } else {
        var valcounts = _.countBy(values)
        var pairs = _.toPairs(valcounts)
        pairs = _.sortBy(pairs, x => x[0])
        data.push({
            type: 'bar',
            x: _.map(pairs, x => x[0]),
            y: _.map(pairs, x => x[1]),
        })
    }
    var layout = {
        margin: {
            l: 50,
            r: 50,
            t: 30,
            b: 60,
        },
        bargap: .1,
        dragmode: 'select',
        selectdirection: 'h',
    }
    var options = {
        'displaylogo': false,
        'displayModeBar': false,
        'modeBarButtonsToRemove': ['sendDataToCloud', 'hoverCompareCartesian', 'toggleSpikelines'],
    }

    Plotly.newPlot(node, data, layout, options)

    node.on('plotly_selected', function(eventData){
        var cellIds = []

        if (eventData !== undefined) {
            var values = get_global_data('plotted_values')
            var selected = _.map(eventData.points, p => p.x)
            var subset;

            if(typeof(selected[0]) === 'string'){
                var select_map = _.keyBy(selected)
                subset = _.pickBy(values, v => v in select_map)
            } else {
                var min = eventData.range.x[0]
                var max = eventData.range.x[1]

                subset = _.pickBy(values, v => v >= min)
                subset = _.pickBy(subset, v => v <= max)
            }
            cellIds = _.keys(subset)
        } else {
            cellIds = []
        }

        var event = new CustomEvent('select-cells', {
            detail: {cells: cellIds}
        })
        window.dispatchEvent(event);
    });
}

function drawDistChartSelection(node, selected_values, remainder_values, selection_name) {

    var isFactor = (typeof(selected_values[0]) === "string") &&
                   (selected_values[0] !== "NA")

    var data = []
    var barmode;

    if (!isFactor) {
        var allvals = selected_values.concat(remainder_values)
        var binmin = _.min(allvals)
        var binmax = _.max(allvals) + 1e-4
        data.push({
            type: 'histogram',
            x: remainder_values,
            autobinx: false,
            xbins: {
                start: binmin,
                end: binmax,
                size: (binmax-binmin)/40,
            },
            name: 'Remainder',
            histnorm: 'percent',
            opacity: 0.7,
        })
        data.push({
            type: 'histogram',
            x: selected_values,
            autobinx: false,
            xbins: {
                start: binmin,
                end: binmax,
                size: (binmax-binmin)/40,
            },
            name: selection_name,
            histnorm: 'percent',
            opacity: 0.7,
        })
        barmode = 'overlay'
    } else {

        allvals = selected_values.concat(remainder_values)
        var valcounts = _(allvals).uniq().keyBy().mapValues(() => 0).value()

        var newvalcounts = _.countBy(remainder_values)
        _.assign(valcounts, newvalcounts)
        var pairs = _.toPairs(valcounts)
        pairs = _.sortBy(pairs, x => x[0])
        data.push({
            type: 'bar',
            name: 'Remainder',
            x: _.map(pairs, x => x[0]),
            y: _.map(pairs, x => x[1]/remainder_values.length*100),
        })

        valcounts = _(allvals).uniq().keyBy().mapValues(() => 0).value()
        newvalcounts = _.countBy(selected_values)
        _.assign(valcounts, newvalcounts)
        pairs = _.toPairs(valcounts)
        pairs = _.sortBy(pairs, x => x[0])
        data.push({
            type: 'bar',
            name: selection_name,
            x: _.map(pairs, x => x[0]),
            y: _.map(pairs, x => x[1]/selected_values.length*100),
        })

        barmode = 'group'
    }
    var layout = {
        margin: {
            l: 50,
            r: 50,
            t: 30,
            b: 60,
        },
        bargap: .1,
        dragmode: 'select',
        barmode: barmode,
    }
    var options = {
        'displaylogo': false,
        'displayModeBar': false,
        'modeBarButtonsToRemove': ['sendDataToCloud', 'hoverCompareCartesian', 'toggleSpikelines'],
    }

    Plotly.newPlot(node, data, layout, options)

    node.on('plotly_selected', function(eventData){
        var cellIds = []

        if (eventData !== undefined) {
            var values = get_global_data('plotted_values')
            var selected = _.map(eventData.points, p => p.x)
            var subset;

            if(typeof(selected[0]) === 'string'){
                var select_map = _.keyBy(selected)
                subset = _.pickBy(values, v => v in select_map)
            } else {
                var min = eventData.range.x[0]
                var max = eventData.range.x[1]

                subset = _.pickBy(values, v => v >= min)
                subset = _.pickBy(subset, v => v <= max)
            }

            cellIds = _.keys(subset)
        } else {
            cellIds = []
        }

        var event = new CustomEvent('select-cells', {
            detail: {cells: cellIds}
        })
        window.dispatchEvent(event);
    });
}


/*
Exports This list of Cell IDs selected
 */
Lower_Left_Content.prototype.exportSelectedCells = function()
{

    var selected_cells = get_global_status('selected_cell')
    var selection_name = get_global_status('selection_name')


    var text = selected_cells.join("\n");

    var file_uri = "data:text/plain;charset=utf-8," + encodeURIComponent(text)

    var a = document.createElement("a");

    // Make selection_name filename-safe
    selection_name = selection_name.replace(/[^a-z0-9]/gi, '_')
    a.download = selection_name + ".txt"
    a.href = file_uri;

    a.click();

}
