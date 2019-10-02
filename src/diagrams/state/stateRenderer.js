import * as d3 from 'd3';
import dagre from 'dagre-layout';
import graphlib from 'graphlibrary';
import { logger } from '../../logger';
import stateDb from './stateDb';
import { parser } from './parser/stateDiagram';
import utils from '../../utils';

parser.yy = stateDb;

const idCache = {};

let stateCnt = 0;
let total = 0;
let edgeCount = 0;

const conf = {
  dividerMargin: 10,
  padding: 5,
  textHeight: 10
};

export const setConf = function(cnf) {};

// Todo optimize
const getGraphId = function(label) {
  const keys = Object.keys(idCache);

  for (let i = 0; i < keys.length; i++) {
    if (idCache[keys[i]].label === label) {
      return keys[i];
    }
  }

  return undefined;
};

/**
 * Setup arrow head and define the marker. The result is appended to the svg.
 */
const insertMarkers = function(elem) {
  elem
    .append('defs')
    .append('marker')
    .attr('id', 'dependencyEnd')
    .attr('refX', 19)
    .attr('refY', 7)
    .attr('markerWidth', 20)
    .attr('markerHeight', 28)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M 19,7 L9,13 L14,7 L9,1 Z');
};
const drawStart = function(elem, stateDef) {
  logger.info('Rendering class ' + stateDef);

  const addTspan = function(textEl, txt, isFirst) {
    const tSpan = textEl
      .append('tspan')
      .attr('x', conf.padding)
      .text(txt);
    if (!isFirst) {
      tSpan.attr('dy', conf.textHeight);
    }
  };

  const id = 'classId' + (stateCnt % total);
  const stateInfo = {
    id: id,
    label: stateDef.id,
    width: 0,
    height: 0
  };

  const g = elem
    .append('g')
    .attr('id', id)
    .attr('class', 'classGroup');
  const title = g
    .append('text')
    .attr('x', conf.padding)
    .attr('y', conf.textHeight + conf.padding)
    .text(stateDef.id);

  const titleHeight = title.node().getBBox().height;

  const stateBox = g.node().getBBox();
  g.insert('rect', ':first-child')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', stateBox.width + 2 * conf.padding)
    .attr('height', stateBox.height + conf.padding + 0.5 * conf.dividerMargin);

  membersLine.attr('x2', stateBox.width + 2 * conf.padding);
  methodsLine.attr('x2', stateBox.width + 2 * conf.padding);

  stateInfo.width = stateBox.width + 2 * conf.padding;
  stateInfo.height = stateBox.height + conf.padding + 0.5 * conf.dividerMargin;

  idCache[id] = stateInfo;
  stateCnt++;
  return stateInfo;
};

/**
 * Draws a start state as a black circle
 */
const drawStartState = g =>
  g
    .append('circle')
    .style('stroke', 'black')
    .style('fill', 'black')
    .attr('r', 5)
    .attr('cx', conf.padding + 5)
    .attr('cy', conf.padding + 5);
/**
 * Draws a an end state as a black circle
 */
const drawSimpleState = (g, stateDef) => {
  const state = g
    .append('text')
    .attr('x', 2 * conf.padding)
    .attr('y', conf.textHeight + 2 * conf.padding)
    .attr('font-size', 24)
    .text(stateDef.id);

  const classBox = state.node().getBBox();
  g.insert('rect', ':first-child')
    .attr('x', conf.padding)
    .attr('y', conf.padding)
    .attr('width', classBox.width + 2 * conf.padding)
    .attr('height', classBox.height + 2 * conf.padding)
    .attr('rx', '5');

  return state;
};
/**
 * Draws a state with descriptions
 * @param {*} g
 * @param {*} stateDef
 */
const drawDescrState = (g, stateDef) => {
  const addTspan = function(textEl, txt, isFirst) {
    const tSpan = textEl
      .append('tspan')
      .attr('x', 2 * conf.padding)
      .text(txt);
    if (!isFirst) {
      tSpan.attr('dy', conf.textHeight);
    }
  };
  const title = g
    .append('text')
    .attr('x', 2 * conf.padding)
    .attr('y', conf.textHeight + 1.5 * conf.padding)
    .attr('font-size', 24)
    .attr('class', 'state-title')
    .text(stateDef.id);

  const titleHeight = title.node().getBBox().height;

  const description = g
    .append('text') // text label for the x axis
    .attr('x', conf.padding)
    .attr('y', titleHeight + conf.padding * 0.2 + conf.dividerMargin + conf.textHeight)
    .attr('fill', 'white')
    .attr('class', 'state-description');

  let isFirst = true;
  stateDef.descriptions.forEach(function(descr) {
    addTspan(description, descr, isFirst);
    isFirst = false;
  });

  const descrLine = g
    .append('line') // text label for the x axis
    .attr('x1', conf.padding)
    .attr('y1', conf.padding + titleHeight + conf.dividerMargin / 2)
    .attr('y2', conf.padding + titleHeight + conf.dividerMargin / 2)
    .attr('class', 'descr-divider');
  const descrBox = description.node().getBBox();
  descrLine.attr('x2', descrBox.width + 3 * conf.padding);
  // const classBox = title.node().getBBox();

  g.insert('rect', ':first-child')
    .attr('x', conf.padding)
    .attr('y', conf.padding)
    .attr('width', descrBox.width + 2 * conf.padding)
    .attr('height', descrBox.height + titleHeight + 2 * conf.padding)
    .attr('rx', '5');

  return g;
};
const drawEndState = g => {
  g.append('circle')
    .style('stroke', 'black')
    .style('fill', 'white')
    .attr('r', 7)
    .attr('cx', conf.padding + 7)
    .attr('cy', conf.padding + 7);

  return g
    .append('circle')
    .style('stroke', 'black')
    .style('fill', 'black')
    .attr('r', 5)
    .attr('cx', conf.padding + 7)
    .attr('cy', conf.padding + 7);
};

const drawEdge = function(elem, path, relation) {
  const getRelationType = function(type) {
    switch (type) {
      case stateDb.relationType.AGGREGATION:
        return 'aggregation';
      case stateDb.relationType.EXTENSION:
        return 'extension';
      case stateDb.relationType.COMPOSITION:
        return 'composition';
      case stateDb.relationType.DEPENDENCY:
        return 'dependency';
    }
  };

  path.points = path.points.filter(p => !Number.isNaN(p.y));

  // The data for our line
  const lineData = path.points;

  // This is the accessor function we talked about above
  const lineFunction = d3
    .line()
    .x(function(d) {
      return d.x;
    })
    .y(function(d) {
      return d.y;
    })
    .curve(d3.curveBasis);

  const svgPath = elem
    .append('path')
    .attr('d', lineFunction(lineData))
    .attr('id', 'edge' + edgeCount)
    .attr('class', 'relation');
  let url = '';
  if (conf.arrowMarkerAbsolute) {
    url =
      window.location.protocol +
      '//' +
      window.location.host +
      window.location.pathname +
      window.location.search;
    url = url.replace(/\(/g, '\\(');
    url = url.replace(/\)/g, '\\)');
  }

  svgPath.attr(
    'marker-end',
    'url(' + url + '#' + getRelationType(stateDb.relationType.DEPENDENCY) + 'End' + ')'
  );

  if (typeof relation.title !== 'undefined') {
    const g = elem.append('g').attr('class', 'classLabel');
    const label = g
      .append('text')
      .attr('class', 'label')
      .attr('fill', 'red')
      .attr('text-anchor', 'middle')
      .text(relation.title);

    const { x, y } = utils.calcLabelPosition(path.points);
    label.attr('x', x).attr('y', y);

    const bounds = label.node().getBBox();
    g.insert('rect', ':first-child')
      .attr('class', 'box')
      .attr('x', bounds.x - conf.padding / 2)
      .attr('y', bounds.y - conf.padding / 2)
      .attr('width', bounds.width + conf.padding)
      .attr('height', bounds.height + conf.padding);

    // Debug points
    // path.points.forEach(point => {
    //   g.append('circle')
    //     .style('stroke', 'red')
    //     .style('fill', 'red')
    //     .attr('r', 1)
    //     .attr('cx', point.x)
    //     .attr('cy', point.y);
    // });

    // g.append('circle')
    //   .style('stroke', 'blue')
    //   .style('fill', 'blue')
    //   .attr('r', 1)
    //   .attr('cx', x)
    //   .attr('cy', y);
  }

  edgeCount++;
};

/**
 * Draws a state
 * @param {*} elem
 * @param {*} stateDef
 */
const drawState = function(elem, stateDef) {
  // logger.info('Rendering class ' + stateDef);

  const id = stateDef.id;
  const stateInfo = {
    id: id,
    label: stateDef.id,
    width: 0,
    height: 0
  };

  const g = elem
    .append('g')
    .attr('id', id)
    .attr('class', 'classGroup');

  if (stateDef.type === 'start') drawStartState(g);
  if (stateDef.type === 'end') drawEndState(g);
  if (stateDef.type === 'default' && stateDef.descriptions.length === 0)
    drawSimpleState(g, stateDef);
  if (stateDef.type === 'default' && stateDef.descriptions.length > 0) drawDescrState(g, stateDef);

  const stateBox = g.node().getBBox();

  stateInfo.width = stateBox.width + 2 * conf.padding;
  stateInfo.height = stateBox.height + 2 * conf.padding;

  idCache[id] = stateInfo;
  stateCnt++;
  return stateInfo;
};

/**
 * Draws a flowchart in the tag with id: id based on the graph definition in text.
 * @param text
 * @param id
 */
export const draw = function(text, id) {
  parser.yy.clear();
  parser.parse(text);
  stateDb.logDocuments();
  logger.info('Rendering diagram ' + text);

  // /// / Fetch the default direction, use TD if none was found
  const diagram = d3.select(`[id='${id}']`);
  insertMarkers(diagram);

  // // Layout graph, Create a new directed graph
  const graph = new graphlib.Graph({
    multigraph: false,
    compound: true
  });

  // Set an object for the graph label
  graph.setGraph({
    isMultiGraph: false
  });

  // // Default to assigning a new object as a label for each new edge.
  graph.setDefaultEdgeLabel(function() {
    return {};
  });

  const states = stateDb.getStates();
  const keys = Object.keys(states);

  total = keys.length;
  for (let i = 0; i < keys.length; i++) {
    const stateDef = states[keys[i]];
    const node = drawState(diagram, stateDef);
    // const nodeAppendix = drawStartState(diagram, stateDef);

    // Add nodes to the graph. The first argument is the node id. The second is
    // metadata about the node. In this case we're going to add labels to each of
    // our nodes.
    graph.setNode(node.id, node);
    // graph.setNode(node.id + 'note', nodeAppendix);

    // let parent = 'p1';
    // if (node.id === 'XState1') {
    //   parent = 'p2';
    // }

    // graph.setParent(node.id, parent);
    // graph.setParent(node.id + 'note', parent);

    // logger.info('Org height: ' + node.height);
  }

  console.info('Count=', graph.nodeCount());
  const relations = stateDb.getRelations();
  relations.forEach(function(relation) {
    graph.setEdge(getGraphId(relation.id1), getGraphId(relation.id2), {
      relation: relation,
      width: 38
    });
    console.warn(getGraphId(relation.id1), getGraphId(relation.id2), {
      relation: relation
    });
    // graph.setEdge(getGraphId(relation.id1), getGraphId(relation.id2));
  });
  dagre.layout(graph);
  graph.nodes().forEach(function(v) {
    if (typeof v !== 'undefined' && typeof graph.node(v) !== 'undefined') {
      logger.debug('Node ' + v + ': ' + JSON.stringify(graph.node(v)));
      d3.select('#' + v).attr(
        'transform',
        'translate(' +
          (graph.node(v).x - graph.node(v).width / 2) +
          ',' +
          (graph.node(v).y - graph.node(v).height / 2) +
          ' )'
      );
    }
  });
  graph.edges().forEach(function(e) {
    if (typeof e !== 'undefined' && typeof graph.edge(e) !== 'undefined') {
      logger.debug('Edge ' + e.v + ' -> ' + e.w + ': ' + JSON.stringify(graph.edge(e)));
      drawEdge(diagram, graph.edge(e), graph.edge(e).relation);
    }
  });

  diagram.attr('height', '100%');
  diagram.attr('width', '100%');
  diagram.attr('viewBox', '0 0 ' + (graph.graph().width + 20) + ' ' + (graph.graph().height + 20));
};

export default {
  setConf,
  draw
};
