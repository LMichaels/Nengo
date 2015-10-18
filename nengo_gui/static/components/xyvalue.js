/**
 * Line graph showing decoded values over time
 * @constructor
 *
 * @param {dict} args - A set of constructor arguments (see Nengo.Component)
 * @param {int} args.n_lines - number of decoded values
 * @param {float} args.miny - minimum value on y-axis
 * @param {float} args.maxy - maximum value on y-axis
 * @param {Nengo.SimControl} args.sim - the simulation controller
 *
 * XYValue constructor is called by python server when a user requests a plot 
 * or when the config file is making graphs. Server request is handled in 
 * netgraph.js {.on_message} function.
 */

Nengo.XYValue = function(parent, sim, args) {
    Nengo.Component.call(this, parent, args);
    var self = this;

    this.n_lines = args.n_lines || 1;
    this.sim = sim;

    /** for storing the accumulated data */
    this.data_store = new Nengo.DataStore(this.n_lines, this.sim, 0);

    args.center_x_axis = true;
    args.center_y_axis = true;
    this.axes2d = new Nengo.Axes2D(this.div, args);
    this.axes2d.axis_y.tickValues([args.min_value, args.max_value]);
    this.axes2d.axis_x.tickValues([args.min_value, args.max_value]);

    /** scales for mapping x and y values to pixels */
    // Why isn't this done in the Axes2D constructor?
    this.axes2d.scale_x.domain([args.min_value, args.max_value]);

    // the two indices of the multi-dimensional data to display
    this.index_x = args.index_x;
    this.index_y = args.index_y;

    /** call schedule_update whenever the time is adjusted in the SimControl */
    this.sim.div.addEventListener('adjust_time',
            function(e) {self.schedule_update();}, false);

    /** call reset whenever the simulation is reset */
    this.sim.div.addEventListener('sim_reset',
            function(e) {self.reset();}, false);

    /** create the lines on the plots */
    var line = d3.svg.line()
        .x(function(d, i) {return self.axes2d.scale_x(self.data_store.data[this.index_x][i]);})
        .y(function(d) {return self.axe2d.scale_y(d);})
    this.path = this.axes2d.svg.append("g").selectAll('path')
                                    .data([this.data_store.data[this.index_y]]);
    this.path.enter().append('path')
             .attr('class', 'line')
             .style('stroke', Nengo.make_colors(1));

    /** create a circle to track the most recent data */
    // TODO:
    // should also listen to the play button to decide when to become visible
    this.recent_circle = this.axes2d.svg.append("circle")
                                        .attr("r", this.get_circle_radius())
                                        .attr('cx', this.axes2d.scale_x(0))
                                        .attr('cy', this.axes2d.scale_y(0))
                                        .style("fill", Nengo.make_colors(2)[1]);

    this.warning_label = this.axes2d.svg.append("g");
    this.invalid_dims = false;

    this.axes2d.fit_ticks(this);
    this.on_resize(this.get_screen_width(), this.get_screen_height());
};
Nengo.XYValue.prototype = Object.create(Nengo.Component.prototype);
Nengo.XYValue.prototype.constructor = Nengo.Value;

/**
 * Receive new line data from the server
 */
Nengo.XYValue.prototype.on_message = function(event) {
    var data = new Float32Array(event.data);
    this.data_store.push(data);
    this.schedule_update();
}

/**
 * Redraw the lines and axis due to changed data
 */
Nengo.XYValue.prototype.update = function() {
    var self = this;

    /** let the data store clear out old values */
    this.data_store.update();

    /** update the lines if there is data with valid dimensions */
    if(this.data_store.data.length > 1){
        var shown_data = this.data_store.get_shown_data();
        var line = d3.svg.line()
            .x(function(d, i) {
                return self.axes2d.scale_x(
                    shown_data[self.index_x][i]);
                })
            .y(function(d) {return self.axes2d.scale_y(d);})
        this.path.data([shown_data[this.index_y]])
                 .attr('d', line);

        /** update the circle */
        var last_index = shown_data[self.index_x].length - 1;
        this.recent_circle.attr('cx', self.axes2d.scale_x(shown_data[self.index_x][last_index]))
                            .attr('cy', self.axes2d.scale_y(shown_data[self.index_y][last_index]));
        if(this.invalid_dims === true){
            // remove the label
             while(this.warning_label.lastChild){
                 this.warning_label.removeChild(this.warning_label.lastChild);
             }
            this.invalid_dims = false;
        }
    } else if(this.invalid_dims == false){
        this.invalid_dims = true;

        // add the label
        // TODO: get rid of magic numbers... somehow
        this.warning_label.append("rect")
          .attr("x", 32.5)
          .attr("y", 30)
          .attr("width", this.width)
          .attr("height", this.height)
          .attr("fill", "yellow")
          .attr("fill-opacity", 0.4);
        // TODO: this css should be extracted
        // we probably don't want the text to be relative...
        // http://stackoverflow.com/a/19589216/1079075
        this.warning_label.append("text")
          .attr("x", this.width/2)
          .attr("y", this.height/2)
          .attr("text-anchor", "middle")
          .attr("alignment-baseline", "middle")
          .style("fill", "red")
          .append("tspan")
            .attr("dy", -12)
            .text("INVALID")
          .append("tspan")
            .attr("dy", 12)
            .text("DIMENSIONS");
    }

};

/**
 * Adjust the graph layout due to changed size
 */
Nengo.XYValue.prototype.on_resize = function(width, height) {
    this.axes2d.on_resize(width, height);

    this.update();

    this.label.style.width = width;
    this.width = width;
    this.height = height;
    this.div.style.width = width;
    this.div.style.height = height;
    this.recent_circle.attr("r", this.get_circle_radius());

    // TODO: Resize warning label
    // HOW IN THE WORLD DO I GET THE SIZE OF THIS THING
    this.warning_label.select("rect")
      .attr("width", width - 60)
      .attr("height", height - 60);
    this.warning_label.selectAll("text")
      .attr("x", width/2)
      .attr("y", this.height/2);
};

Nengo.XYValue.prototype.get_circle_radius = function() {
    return Math.min(this.width, this.height) / 30;
}

Nengo.XYValue.prototype.generate_menu = function() {
    var self = this;
    var items = [];
    items.push(['Set range...', function() {self.set_range();}]);
    items.push(['Set X, Y indices...', function() {self.set_indices();}]);

    // add the parent's menu items to this
    // TODO: is this really the best way to call the parent's generate_menu()?
    return $.merge(items, Nengo.Component.prototype.generate_menu.call(this));
};


Nengo.XYValue.prototype.layout_info = function () {
    var info = Nengo.Component.prototype.layout_info.call(this);
    info.min_value = this.axes2d.scale_y.domain()[0];
    info.max_value = this.axes2d.scale_y.domain()[1];
    info.index_x = this.index_x;
    info.index_y = this.index_y;
    return info;
}

Nengo.XYValue.prototype.update_layout = function (config) {
    this.update_indices(config.index_x, config.index_y);
    this.update_range(config.min_value, config.max_value);
    Nengo.Component.prototype.update_layout.call(this, config);
}

Nengo.XYValue.prototype.set_range = function() {
    var range = this.axes2d.scale_y.domain();
    var self = this;
    Nengo.modal.title('Set graph range...');
    Nengo.modal.single_input_body(range, 'New range');
    Nengo.modal.footer('ok_cancel', function(e) {
        var new_range = $('#singleInput').val();
        var modal = $('#myModalForm').data('bs.validator');

        modal.validate();
        if (modal.hasErrors() || modal.isIncomplete()) {
            return;
        }
        if (new_range !== null) {
            new_range = new_range.split(',');
            var min = parseFloat(new_range[0]);
            var max = parseFloat(new_range[1]);
            self.update_range(min, max);
            self.update();
            self.save_layout();
        }
        $('#OK').attr('data-dismiss', 'modal');
    });
    var $form = $('#myModalForm').validator({
        custom: {
            my_validator: function($item) {
                var nums = $item.val().split(',');
                var valid = false;
                if ($.isNumeric(nums[0]) && $.isNumeric(nums[1])) {
                    if (Number(nums[0]) < Number(nums[1])) {
                        valid = true; //Two numbers, 1st less than 2nd
                    }
                }
                return (nums.length == 2 && valid);
            }
        }
    });

    $('#singleInput').attr('data-error', 'Input should be in the form ' +
                           '"<min>,<max>".');
    Nengo.modal.show();
}

Nengo.XYValue.prototype.update_range = function(min, max) {
    this.axes2d.scale_x.domain([min, max]);
    this.axes2d.scale_y.domain([min, max]);
    this.axes2d.axis_x.tickValues([min, max]);
    this.axes2d.axis_y.tickValues([min, max]);
    this.axes2d.axis_y_g.call(this.axes2d.axis_y);
    this.axes2d.axis_x_g.call(this.axes2d.axis_x);
}

Nengo.XYValue.prototype.set_indices = function() {
    var self = this;
    Nengo.modal.title('Set X and Y indices...');
    Nengo.modal.single_input_body([this.index_x,this.index_y], 'New indices');
    Nengo.modal.footer('ok_cancel', function(e) {
        var new_indices = $('#singleInput').val();
        var modal = $('#myModalForm').data('bs.validator');

        modal.validate();
        if (modal.hasErrors() || modal.isIncomplete()) {
            return;
        }
        if (new_indices !== null) {
            new_indices = new_indices.split(',');
            self.update_indices(parseInt(new_indices[0]),
                                parseInt(new_indices[1]));
            self.save_layout();
        }
        $('#OK').attr('data-dismiss', 'modal');
    });
    var $form = $('#myModalForm').validator({
        custom: {
            my_validator: function($item) {
                var nums = $item.val().split(',');
                return ((parseInt(Number(nums[0])) == nums[0]) &&
                        (parseInt(Number(nums[1])) == nums[1]) &&
                        (nums.length == 2) &&
                        (Number(nums[1])<self.n_lines && Number(nums[1])>=0) &&
                        (Number(nums[0])<self.n_lines && Number(nums[0])>=0));
            }
        }
    });

    $('#singleInput').attr('data-error', 'Input should be two positive ' +
                           'integers in the form "<dimension 1>,<dimension 2>". ' +
                           'Dimensions are zero indexed.');

    Nengo.modal.show();
}

Nengo.XYValue.prototype.update_indices = function(index_x, index_y) {
    this.index_x = index_x;
    this.index_y = index_y;
    this.update();
}

Nengo.XYValue.prototype.reset = function(event) {
    this.data_store.reset();
    this.schedule_update();
}
