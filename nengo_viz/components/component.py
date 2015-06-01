import json

class Component(object):
    def __init__(self, viz, config, uid):
        self.config = config
        self.uid = uid

    def update_client(self, client):
        pass
    def message(self, msg):
        print('unhandled message', msg)

    def finish(self):
        pass

    def add_nengo_objects(self, viz):
        pass

    def remove_nengo_objects(self, viz):
        pass

    def javascript_config(self, cfg):
        for attr in self.config._clsparams.params:
            cfg[attr] = getattr(self.config, attr)
        return json.dumps(cfg)


class Template(object):
    default_params = dict(x=0, y=0, width=100, height=100, label_visible=True)

    def __init__(self, *args, **kwargs):
        self.args = args
        self.kwargs = kwargs
    def create(self, vizsim):
        uid = vizsim.viz.get_uid(self)
        print(uid, 'in component creation uid')
        print(vizsim, 'viz.sim')
        print(vizsim.viz.config[self], 'config')
        print(self.args, 'args')
        print(self.kwargs, 'kwargs')
        c = self.cls(vizsim, vizsim.viz.config[self], uid,
                     *self.args, **self.kwargs)
        c.template = self
        return c
    def code_python(self, uids):
        args = [uids[x] for x in self.args]
        name = self.__class__.__name__
        return 'nengo_viz.components.%s(%s)' % (name, ','.join(args))

